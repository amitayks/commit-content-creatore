## ADDED Requirements

### Requirement: Router dispatches Telegram commands via lookup table
The system SHALL route incoming slash commands (e.g., `/start`, `/generate`, `/help`) through a `commandHandlers` dispatch table (`Record<string, CommandHandler>`) instead of a switch statement. Unknown commands SHALL fall back to the home view.

#### Scenario: Known command dispatched
- **WHEN** a user sends `/drafts`
- **THEN** the router looks up `drafts` in `commandHandlers` and invokes the corresponding handler function

#### Scenario: Unknown command shows home
- **WHEN** a user sends `/unknown`
- **THEN** the router finds no match in `commandHandlers` and responds with `renderHome()`

### Requirement: Router dispatches callback actions via lookup table
The system SHALL route callback queries (button clicks) through dispatch tables based on the callback data prefix (`view:`, `action:`, `draft:`, `page:`, `repo:`, `config:`). Each prefix SHALL map to a handler function.

#### Scenario: View callback dispatched
- **WHEN** user clicks a button with `callback_data: "view:drafts"`
- **THEN** the router parses prefix `view` and value `drafts`, then invokes the view-change handler

#### Scenario: Action callback dispatched with entity ID
- **WHEN** user clicks a button with `callback_data: "action:publish:abc123"`
- **THEN** the router parses prefix `action`, action `publish`, and entity ID `abc123`, then invokes the publish action handler

#### Scenario: Pagination callback dispatched with list type
- **WHEN** user clicks a button with `callback_data: "page:auto:2"`
- **THEN** the router parses prefix `page`, list type `auto`, and page number `2`, then invokes the pagination handler with type awareness

#### Scenario: Legacy pagination callback handled gracefully
- **WHEN** user clicks a cached button with `callback_data: "page:2"` (old format)
- **THEN** the pagination handler SHALL treat it as auto-generated drafts page 2

### Requirement: Router dispatches awaiting-input state via lookup table
The system SHALL route text messages when `context.awaiting_input` is set through an `inputHandlers` dispatch table (`Record<string, InputHandler>`). Each awaiting-input type (e.g., `commit_sha`, `schedule`, `add_repo`, `edit_draft`) SHALL have its own handler.

#### Scenario: Awaiting commit SHA input dispatched
- **WHEN** a user sends text while `context.awaiting_input === "commit_sha"`
- **THEN** the router looks up `commit_sha` in `inputHandlers` and invokes the generate input handler

### Requirement: Handler context object reduces parameter passing
Each handler function SHALL receive a `HandlerContext` object containing `{ env, chatId }` and optionally `{ messageId, args }`. Handlers SHALL NOT receive these as separate positional parameters.

#### Scenario: Command handler receives context
- **WHEN** the router invokes a command handler
- **THEN** the handler receives a single `HandlerContext` with `env`, `chatId`, and `args` (the text after the command)

#### Scenario: Action handler receives context with IDs
- **WHEN** the router invokes an action handler
- **THEN** the handler receives `HandlerContext` with `env`, `chatId`, `messageId`, and parsed callback parts (`value`, `extra`)

### Requirement: respond utility combines message send and state update
The system SHALL provide a `respond(env, chatId, view, opts?)` function that sends/edits a Telegram message AND updates chat state in a single call. This SHALL replace all instances of manual `sendMessage + updateChatState` patterns.

#### Scenario: Respond sends new message with state
- **WHEN** `respond()` is called with a view and `{ viewName: "drafts", context: { page: 0 } }`
- **THEN** it calls `sendMessage(env, chatId, view.text, view.keyboard)` and then `updateChatState(env, chatId, { message_id, current_view: "drafts", context: { page: 0 } })`

#### Scenario: Respond edits existing message
- **WHEN** `respond()` is called with `{ edit: true, messageId: 123 }`
- **THEN** it calls `editMessage(env, chatId, 123, view.text, view.keyboard)` instead of `sendMessage`

### Requirement: Router handles photo-to-text message transition
The callback router SHALL detect when the current Telegram message is a photo message. When the response is text-only, it SHALL delete the photo message and send a new text message. Individual action handlers SHALL NOT handle this transition.

#### Scenario: Text response after photo message
- **WHEN** an action returns a text view and the current callback message contains `photo`
- **THEN** the router deletes the photo message and sends a new text message with the view content

#### Scenario: Text response after text message
- **WHEN** an action returns a text view and the current callback message is a regular text message
- **THEN** the router edits the existing message in place

### Requirement: One file per command handler
Each Telegram slash command SHALL have its own file in `commands/` directory. Each file SHALL export a single handler function matching the `CommandHandler` type signature.

#### Scenario: /generate command file
- **WHEN** the `/generate` command is invoked
- **THEN** the handler in `commands/generate.ts` is called, which either prompts for SHA or runs generation directly if args provided

### Requirement: One file per action handler
Each callback action type SHALL have its own file in `actions/` directory. Related actions (e.g., all repo management actions) MAY share a file.

#### Scenario: Publish action file
- **WHEN** the `action:publish:{id}` callback is triggered
- **THEN** the handler in `actions/publish.ts` is called

### Requirement: One file per input handler
Each `awaiting_input` type SHALL have its own file in `inputs/` directory.

#### Scenario: Edit draft input file
- **WHEN** user sends text while `awaiting_input === "edit_draft"`
- **THEN** the handler in `inputs/edit-draft.ts` is called

### Requirement: Telegram command menu registration
The setup endpoint SHALL call the Telegram `setMyCommands` API to register all slash commands with descriptions, enabling native `/` autocomplete in Telegram.

#### Scenario: Setup registers commands
- **WHEN** the `/setup` endpoint is called
- **THEN** it SHALL call `setMyCommands` with all available commands and their descriptions
- **AND** this SHALL happen after `setWebhook` succeeds

#### Scenario: Command list content
- **WHEN** `setMyCommands` is called
- **THEN** it SHALL register: start, generate, approve, drafts, repos, schedule, delete, help, watch, handwrite
- **AND** each command SHALL have a short description
- **AND** handwrite SHALL have description "Write your own tweet or thread"

### Requirement: /handwrite command registered and dispatched
The `/handwrite` command SHALL be registered in the command dispatch table and in the Telegram command menu via `setMyCommands`.

#### Scenario: /handwrite command dispatched
- **WHEN** user sends `/handwrite`
- **THEN** the router SHALL look up `handwrite` in `commandHandlers` and invoke `commands/handwrite.ts`

### Requirement: edited_message update type routed
The worker entry point SHALL handle `edited_message` updates from Telegram and route them to the message handler with an `isEdit` flag.

#### Scenario: edited_message received during compose
- **WHEN** Telegram sends an update with `edited_message` field
- **THEN** the worker SHALL extract the message and route it to the message handler
- **AND** the handler SHALL check if compose mode is active and update the buffer

#### Scenario: edited_message received outside compose
- **WHEN** Telegram sends an `edited_message` update and the chat is not in compose mode
- **THEN** the update SHALL be silently ignored (no error, no response)

### Requirement: Compose-aware message routing
The message handler SHALL check for compose mode (`awaiting_input === 'handwrite'`) before checking for slash commands, with special handling for recognized commands.

#### Scenario: Text message during compose
- **WHEN** a text message arrives and `awaiting_input === 'handwrite'`
- **AND** the text does NOT start with a recognized slash command
- **THEN** the message SHALL be routed to the `handwrite` input handler for buffering

#### Scenario: Recognized command during compose cancels session
- **WHEN** a text message arrives and `awaiting_input === 'handwrite'`
- **AND** the text starts with a recognized slash command (e.g., `/drafts`, `/help`)
- **THEN** the compose session SHALL be cancelled (buffer discarded)
- **AND** the command SHALL be dispatched normally

### Requirement: Compose action callbacks
The system SHALL handle callback prefixes for compose mode actions: `compose:pendown`, `compose:toggle_image`, `compose:toggle_ai`, `compose:cancel`.

#### Scenario: Pen down callback
- **WHEN** user clicks button with `callback_data: "compose:pendown"`
- **THEN** the router SHALL invoke the pen-down action handler

#### Scenario: Toggle callback
- **WHEN** user clicks button with `callback_data: "compose:toggle_image"` or `"compose:toggle_ai"`
- **THEN** the router SHALL invoke the compose toggle handler

#### Scenario: Cancel callback
- **WHEN** user clicks button with `callback_data: "compose:cancel"`
- **THEN** the router SHALL invoke the compose cancel handler

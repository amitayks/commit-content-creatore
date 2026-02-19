## ADDED Requirements

### Requirement: Inline buttons support color styles
The system SHALL pass the optional `style` field ("primary", "success", "danger") to Telegram's InlineKeyboardButton when present on an InlineButton.

#### Scenario: Button with style is sent to Telegram
- **WHEN** a view returns an InlineButton with `style: "danger"`
- **THEN** the Telegram API call includes `style: "danger"` in the button object

#### Scenario: Button without style uses default
- **WHEN** a view returns an InlineButton without a `style` field
- **THEN** the Telegram API call does not include a `style` field (Telegram uses default gray)

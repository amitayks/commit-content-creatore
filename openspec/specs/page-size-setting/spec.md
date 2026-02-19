## ADDED Requirements

### Requirement: Page size setting in user settings
The system SHALL display a "Page Size" setting in the `/settings` view showing the current page size value.

#### Scenario: Settings view shows page size
- **WHEN** user opens settings
- **THEN** the settings view displays the current page size (default 5)
- **AND** a "📏 Page Size" button is available to change the value

### Requirement: Page size selector
The system SHALL provide a selector with preset page size options.

#### Scenario: Page size selector shows presets
- **WHEN** user taps the page size button in settings
- **THEN** a selector is shown with options: 5, 10, 15, 20
- **AND** each option uses callback `config:page_size:<N>`

#### Scenario: Selecting page size saves and returns to settings
- **WHEN** user selects a page size option
- **THEN** the page size is saved to the database for that user
- **AND** the settings view is re-rendered showing the new page size

### Requirement: Page size applies to all list views
The system SHALL use the user's configured page size for all paginated list views.

#### Scenario: Draft list uses configured page size
- **WHEN** user has page size set to 15 and views a draft list
- **THEN** up to 15 drafts are shown per page

#### Scenario: Default page size is 5
- **WHEN** user has not configured a page size
- **THEN** all lists default to 5 items per page

### Requirement: Page size stored in chat_state
The system SHALL store the page size as an integer column in the `chat_state` table with a default value of 5.

#### Scenario: Database migration adds page_size column
- **WHEN** the migration runs
- **THEN** `chat_state` table has a `page_size` column with default 5

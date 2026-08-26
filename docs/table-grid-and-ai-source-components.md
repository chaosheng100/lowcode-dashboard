# Data Grid and AI Source Component Contracts

Updated: 2026-08-27

## Data Grid

The editor now exposes `grid` as the canonical component for multi-column structured data. It replaces the previous catalog entry named "表格".

Runtime rules:

- New schemas save as `type: grid`.
- Screens previously saved with `type: table` are migrated to `grid` while loading.
- Both names map to the shared table renderer, so old published content remains readable.
- Dataset-bound grids receive complete row objects in `props.data`.
- `props.columns` contains normalized `{ key, title, dataSetFieldKey }` values derived from `dataSource.fields`.
- Invalid or missing field selections fall back to the dataset's available columns.
- Charts retain their existing `{ name, value }` point shape.

Manual binding is available from the property panel. The user selects displayed fields; their order controls column order. Resource-panel binding writes semantic dimension/metric defaults only.

## AI Source Components

AI-generated HTML and React output is treated as an independent visual asset, not a data-widget replacement.

Generation prompts prohibit:

- reading `window.__DASHBOARD__`
- listening for `dashboard:update`
- emitting `<table data-dashboard-table></table>`
- calling datasets, business APIs, SQL, or carrying credentials

Registered source assets use `dataContract: []` and mark themselves as standalone visuals. The property panel does not offer dataset binding for them. Remote runtime refresh returns immediately for these types, even if a very old screen still contains residual `dataSource` or `dataSourceId` values.

Use `grid` for standard detail views. Use AI source components only for bespoke visual cards where platform-managed dataset linkage is not required.

## Compatibility Checks

- Existing table schemas continue rendering after migration to grid.
- Existing AI components preserve source code and style during load cleanup.
- Residual bindings on source components do not trigger remote refresh requests.
- Editor and runtime use the same normalized rows/columns contract.

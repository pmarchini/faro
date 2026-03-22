# Sidebar Destination Selection

## Status

`todo`

## Problem

Faro currently exposes one sidebar webview and switches between `home`, `path`, and `setup` as internal routes inside that surface.

That keeps the VS Code container simple, but it also mixes three distinct concerns behind one composite view:

- onboarding and orientation
- path reading and navigation
- agent/tooling setup

This creates two kinds of complexity:

- product complexity, because the user must understand one surface with multiple internal destinations
- implementation complexity, because route switching, route-specific loading, and route-specific transient UI state all live inside one provider

The current model also limits future refactors because route-specific UI concerns are still coupled through one webview shell.

## Goal

Choose a clearer top-level navigation model for the Faro sidebar that:

- lowers cognitive complexity for users
- lowers architectural complexity in the UI layer
- stays aligned with VS Code-native navigation affordances
- keeps future refactors easier and more local

## Scope

In scope:

- top-level navigation between `home`, `path`, and `setup`
- VS Code sidebar/view-container UX for selecting those destinations
- the state model needed to support the chosen navigation shape
- constraints for shared UI building blocks and styling reuse

Out of scope:

- changing path traversal semantics
- changing setup install semantics
- redesigning the content of `home`, `path`, or `setup` beyond what the new navigation shape requires
- path list selection within the `path` destination

## Option A: Three Views

Split the current composite sidebar into three separate VS Code views under the Faro container:

- `Home`
- `Path`
- `Setup`

The user would switch destinations through VS Code's native view/container affordances rather than through internal in-webview route buttons.

### Why Consider This

- each view owns one coherent responsibility
- route-switching logic inside one composite provider can be removed or reduced sharply
- route-specific loading and transient state can stay local to the relevant view
- future refactors can target one destination without reopening the entire shell
- the VS Code container structure becomes a more direct representation of the product structure

### Architectural Constraints

- common UI building blocks MUST be extracted before or alongside the split into `Home`, `Path`, and `Setup`
- separate views MUST reuse shared UI modules for repeated presentation and interaction patterns
- shared building blocks MUST cover repeated CSS tokens, layout primitives, action bars, cards, empty states, notices, and modal or confirmation surfaces
- separate views MUST compose shared building blocks rather than copying HTML, CSS, or interaction wiring per view
- the split is not acceptable if it creates parallel styling systems or diverging implementations of the same UI behavior
- view-specific state and behavior should move closer to the owning view instead of being preserved in one shared route controller

### Acceptance Criteria

- Faro exposes separate sidebar views for `Home`, `Path`, and `Setup`
- users can move between those destinations through VS Code-native view selection
- route-specific conditional rendering in one composite main view is removed or materially reduced
- repeated UI primitives are implemented through shared modules rather than copied per view
- modal and confirmation behavior uses shared building blocks with view-specific content only
- visual styling remains consistent across views through shared CSS and theme primitives
- a shared UI pattern can be changed in one place and reflected across all relevant views
- path and setup behavior still delegate to their existing canonical services and store semantics

### Risks

- splitting views may introduce duplicated markup, CSS, or message handling unless extraction happens first
- the VS Code multi-view structure may feel heavier if the three destinations are not all used frequently
- shared shell behavior may drift if view boundaries are introduced without clear UI composition rules

## Option B: One View With Three Commands

Keep one Faro webview, but replace the current in-webview route buttons with three VS Code-native commands exposed from the view title area:

- `Open Home`
- `Open Path`
- `Open Setup`

Those commands would update the selected destination in extension state and rerender the single view accordingly.

### Why Consider This

- it keeps the current architecture mostly intact
- it uses VS Code-native chrome more effectively than custom route buttons inside the webview
- it reduces visible in-webview navigation without requiring a larger split across multiple views
- it is likely the smallest migration from the current implementation

### Architectural Constraints

- the three destination commands should map onto one canonical selected-destination state
- the UI must not depend on a native dropdown passing arbitrary values directly into the webview
- route-specific cleanup and loading behavior must remain explicit and testable
- command-based selection must not duplicate path or setup business rules

### Acceptance Criteria

- Faro keeps one main sidebar view
- the current in-webview top navigation is replaced or materially deemphasized in favor of view-title commands
- users can open `home`, `path`, and `setup` through VS Code-native command affordances
- selected destination state remains consistent across rerenders and workspace reloads
- route-specific setup loading and transient cleanup still work correctly
- path and setup behavior still delegate to their existing canonical services and store semantics

### Risks

- internal route complexity remains, even if the visual control changes
- the single view may still accumulate concerns over time
- future refactors still need to work inside one composite surface

## Decision Criteria

Evaluate the two options against:

- cognitive load for users
- cognitive load in the codebase
- alignment with VS Code-native navigation patterns
- migration cost from the current implementation
- ease of future refactors
- ability to preserve shared UI consistency without duplication

## Recommendation Shape

The proposal should be accepted only after choosing one of these as the implementation direction:

- prefer `Option A` if the priority is reducing long-term UI and architectural complexity
- prefer `Option B` if the priority is incremental delivery with minimal churn to the current implementation

`Option A` is the stronger long-term structural move, but only if shared UI building blocks are extracted as a hard requirement rather than deferred cleanup.

## Next Step

Decide whether Faro should optimize first for:

- long-term structural clarity through three separate views
- or lower-risk incremental evolution through one view with three native commands

Once that decision is made, create the implementation slice proposal with concrete migration steps for the chosen option only.

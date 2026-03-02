# Tavern Tycoon --- System Diagram

## High-Level Architecture

``` mermaid
flowchart TD

    TG[Telegram Mini App Container]
    UI[React UI Layer]
    GAME[Phaser Game Scene]
    DOMAIN[Domain Logic Layer]
    STATE[Game State Store]
    STORAGE[LocalStorage]
    STORYBOOK[Storybook Spec]

    TG --> UI
    UI <--> GAME
    UI --> DOMAIN
    GAME --> DOMAIN
    DOMAIN --> STATE
    STATE --> STORAGE
    UI --> STORYBOOK
```

## Layer Responsibilities

### Telegram Container

-   Provides WebApp API
-   Supplies initData
-   Handles referrals

### React UI

-   Screens and modals
-   Navigation
-   Hero management
-   Upgrade panels

### Phaser Scene

-   Tavern rendering
-   Idle loop tick
-   Animations and particles

### Domain Layer

-   Income calculations
-   Progression formulas
-   Upgrade logic
-   Offline progress calculation

### State Layer

-   Serializable state
-   Deterministic calculations
-   Local persistence

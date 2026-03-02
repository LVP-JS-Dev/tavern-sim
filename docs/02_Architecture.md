# Architecture Specification

## Technology Stack

  Layer        Technology          Responsibility
  ------------ ------------------- -----------------------------------------------
  Game Layer   Phaser              Rendering tavern scene, animations, idle loop
  UI Layer     React               Panels, modals, navigation
  Language     TypeScript          Source of truth for types
  Platform     Telegram Mini App   WebApp API integration

## Architectural Principles

-   Strict separation: game/, ui/, domain/, shared/types/
-   Event-driven bridge between Phaser and React
-   Serializable game state
-   Offline deterministic calculations
-   Strict TypeScript mode

## Storybook Requirements

-   Machine-readable
-   CSF format
-   TypeScript as source of truth
-   Auto-generated JSON schemas
-   CI validation

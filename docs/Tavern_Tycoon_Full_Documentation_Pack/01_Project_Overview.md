# Tavern Tycoon --- Project Overview

## General Concept

**Name:** Tavern Tycoon\
**Platform:** Telegram Mini App\
**Genre:** Idle / Management / Incremental\
**Tech Stack:** Phaser (Scene) + React (UI) + TypeScript

## MVP Scope

Main Tavern Screen (Phaser)\
Additional Screens: - Upgrade - Heroes List - Hero Details - Daily
Rewards - Invite - Offline Progress Popup

## Core Loop

Heroes generate gold over time.

Formula (MVP):

income = Σ(hero.incomePerSecond \* hero.level)

Offline progress calculated via timestamp delta.

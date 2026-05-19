# Snooker Game - p5.js Physics Simulation

A realistic snooker game simulation built with p5.js and Matter.js physics engine. Features multiple game modes, ball physics, collision detection, and visual effects.

## Features

### Core Gameplay
- Realistic ball physics using Matter.js engine
- Mouse-controlled cue aiming with power meter
- Ball trajectory prediction (Practice Mode)
- Ball trails and visual effects
- Pocket animations and cue impact effects

### Game Modes

**Mode 1: Standard Triangle**
- Traditional snooker setup with 15 red balls in a triangle formation
- Colored balls placed at standard snooker positions
- Standard snooker rules apply

**Mode 2: Random Clusters**
- Red balls placed in 3 random clusters around the table
- Colored balls at standard positions
- Tests adaptability and strategic thinking

**Mode 3: Practice Line**
- Guided aiming with trajectory prediction
- Shows ball collision points and bounce paths
- Perfect for practicing shot accuracy

**Mode 4: Pinball Mode (Extension)**
- Unique twist on traditional snooker
- 6 randomly placed pinball-style bumpers on the table
- Bumpers add unpredictable bounces and require creative shot planning
- Balls receive a speed boost when hitting bumpers

## Controls

| Key | Action |
|-----|--------|
| 1 | Switch to Mode 1 (Standard Triangle) |
| 2 | Switch to Mode 2 (Random Clusters) |
| 3 | Switch to Mode 3 (Practice Line) |
| 4 | Switch to Mode 4 (Pinball Mode) |
| R | Restart current mode |
| Mouse Click + Drag | Aim and shoot cue ball |

## How to Play

1. **Place the Cue Ball** - Click inside the D-zone (semi-circle on the left) to place the white cue ball

2. **Aim** - Click and drag the mouse away from the cue ball:
   - Direction determines shot angle
   - Distance determines shot power (shown on power meter)
   - The cue stick pulls back as you drag

3. **Shoot** - Release the mouse button to take the shot

4. **Score** - Points are awarded based on snooker rules:
   - Red balls: 1 point each
   - Yellow: 2 points
   - Green: 3 points
   - Brown: 4 points
   - Blue: 5 points
   - Pink: 6 points
   - Black: 7 points

## Visual Effects

- **Ball Trails** - Particles follow moving balls
- **Cue Impact** - Flash and ripple effect when cue ball is struck
- **Pocket Animation** - Pulse effect when balls are potted
- **Aiming Guide** - Shows shot trajectory and ball collisions
- **Power Meter** - Visual feedback for shot power

## Installation

1. Clone or download this repository
2. Open `index.html` in a web browser (requires internet connection for p5.js and Matter.js libraries)

## File Structure

import { cp, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';

// The pre_assets folder is in the parent repository
// Use relative path: go up from .worktrees/frontend-phaser to main repo
const PRE_ASSETS = resolve(__dirname, '../../pre_assets/tavern_tycoon_assets');
const PUBLIC_ASSETS = resolve(__dirname, '../public/assets/sprites');

async function copyAssets(): Promise<void> {
  console.log('Copying assets from pre_assets to public...');
  console.log('Source:', PRE_ASSETS);
  console.log('Target:', PUBLIC_ASSETS);

  // Verify source exists
  if (!existsSync(PRE_ASSETS)) {
    throw new Error(`Source assets directory not found: ${PRE_ASSETS}`);
  }

  // Create target directories
  const dirs = ['env', 'bg', 'visitors', 'heroes', 'ui'];
  for (const dir of dirs) {
    const target = resolve(PUBLIC_ASSETS, dir);
    if (!existsSync(target)) {
      await mkdir(target, { recursive: true });
      console.log(`Created directory: ${target}`);
    }
  }

  // Copy selected assets
  const copies: Promise<void>[] = [];

  // Environment - table and chair
  copies.push(
    cp(`${PRE_ASSETS}/env_props/env_table_01x02_01_v3.png`, `${PUBLIC_ASSETS}/env/table.png`)
      .then(() => console.log('Copied: table.png'))
      .catch((err) => console.error('Failed to copy table.png:', err.message))
  );
  copies.push(
    cp(`${PRE_ASSETS}/env_props/env_chair_01_v3.png`, `${PUBLIC_ASSETS}/env/chair.png`)
      .then(() => console.log('Copied: chair.png'))
      .catch((err) => console.error('Failed to copy chair.png:', err.message))
  );

  // Background - floor texture
  copies.push(
    cp(`${PRE_ASSETS}/env_bg/env_tavern_fg_shadows_01_v3.png`, `${PUBLIC_ASSETS}/bg/floor.png`)
      .then(() => console.log('Copied: floor.png'))
      .catch((err) => console.error('Failed to copy floor.png:', err.message))
  );

  // Visitors (02-04 are available)
  const visitorNums = ['02', '03', '04'];
  for (const num of visitorNums) {
    copies.push(
      cp(`${PRE_ASSETS}/npc_visitors/npc_visitor_${num}_idle_v3.png`, `${PUBLIC_ASSETS}/visitors/visitor-${num}-idle.png`)
        .then(() => console.log(`Copied: visitor-${num}-idle.png`))
        .catch((err) => console.error(`Failed to copy visitor-${num}-idle.png:`, err.message))
    );
  }

  // Heroes (02=bard, 03=warrior, 04=mage, 05=rogue based on task spec)
  const heroMap: [string, string][] = [
    ['hero_02', 'bard'],
    ['hero_03', 'warrior'],
    ['hero_04', 'mage'],
    ['hero_05', 'rogue'],
  ];
  for (const [src, dest] of heroMap) {
    copies.push(
      cp(`${PRE_ASSETS}/heroes/${src}_idle_v3.png`, `${PUBLIC_ASSETS}/heroes/${dest}-idle.png`)
        .then(() => console.log(`Copied: ${dest}-idle.png`))
        .catch((err) => console.error(`Failed to copy ${dest}-idle.png:`, err.message))
    );
  }

  // UI - use stat_hp as gold icon (closest available), and button
  copies.push(
    cp(`${PRE_ASSETS}/ui_icons/icon_stat_hp_01_v2.png`, `${PUBLIC_ASSETS}/ui/icon-gold.png`)
      .then(() => console.log('Copied: icon-gold.png'))
      .catch((err) => console.error('Failed to copy icon-gold.png:', err.message))
  );
  copies.push(
    cp(`${PRE_ASSETS}/ui_core/ui_button_secondary_01_v3.png`, `${PUBLIC_ASSETS}/ui/button-primary.png`)
      .then(() => console.log('Copied: button-primary.png'))
      .catch((err) => console.error('Failed to copy button-primary.png:', err.message))
  );

  await Promise.all(copies);
  console.log('\nAssets copied successfully!');
}

copyAssets().catch((err) => {
  console.error('Failed to copy assets:', err);
  process.exit(1);
});

import fs from 'node:fs';
import path from 'node:path';

import type { Configuration, Compiler } from 'webpack';

import { rules } from './webpack.rules';
import { plugins } from './webpack.plugins';

const ensureBetterSqlite3Binding = (): void => {
  const releaseDir = path.resolve(
    __dirname,
    'node_modules/better-sqlite3/build/Release',
  );
  const dest = path.join(releaseDir, 'better_sqlite3.node');
  const prebuild = path.resolve(
    __dirname,
    `node_modules/better-sqlite3/prebuilds/${process.platform}-${process.arch}.node`,
  );

  if (!fs.existsSync(prebuild)) {
    return;
  }

  fs.mkdirSync(releaseDir, { recursive: true });
  fs.copyFileSync(prebuild, dest);
};

const ensureBetterSqlite3Plugin = {
  apply(compiler: Compiler): void {
    compiler.hooks.beforeRun.tap('EnsureBetterSqlite3Binding', ensureBetterSqlite3Binding);
    compiler.hooks.watchRun.tap('EnsureBetterSqlite3Binding', ensureBetterSqlite3Binding);
  },
};

export const mainConfig: Configuration = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: './src/index.ts',
  // Put your normal webpack config below here
  module: {
    rules,
  },
  plugins: [...plugins, ensureBetterSqlite3Plugin],
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
  },
};

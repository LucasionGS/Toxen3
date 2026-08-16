/**
 * postinstall hook: apply the patches in patches/ via patch-package.
 *
 * Skipped on Windows. The only patch we carry targets electron-installer-redhat,
 * which declares `"os": ["darwin", "linux"]` and is an optional dependency of
 * @electron-forge/maker-rpm, so npm does not install it on Windows at all.
 * patch-package treats a patch whose target package is missing as a hard error
 * and exits non-zero, which fails `npm ci` on the Windows release job.
 *
 * RPMs are only ever built on Linux, so there is nothing to patch on Windows.
 */
const { spawnSync } = require("node:child_process");

if (process.platform === "win32") {
  console.log("apply-patches: skipping on Windows (no Linux-only packages installed).");
  process.exit(0);
}

const result = spawnSync(process.execPath, [require.resolve("patch-package")], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);

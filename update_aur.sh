
if [ -d .aur ]; then
  rm -rf .aur
fi
mkdir -p .aur
git -c init.defaultBranch=master clone ssh://aur@aur.archlinux.org/toxen3.git .aur
cp PKGBUILD .aur/PKGBUILD
makepkg --printsrcinfo > .aur/.SRCINFO
cd .aur
git add PKGBUILD .SRCINFO
git commit -m "Update PKGBUILD and .SRCINFO for Toxen"
git push
#!/usr/bin/env bash

cd node_modules/cesium

echo "Faking a .git repo to please husky"
mkdir -p .git

echo "Fetching the uncountable number of dependencies of Cesium"
npm i

echo "Workaround broken release process"
cp ../../_cs_gulpfile.cjs gulpfile.cjs

echo "Build in release mode"
npm run release

cd ../..
echo "Linking CSS files"
for i in `find node_modules/cesium/Build/Cesium/Widgets -name "*.css"`; do f=`echo $i | sed 'sY.*gets/YYg'`; dn=`echo $f | xargs dirname`; fn="`echo $f | xargs basename`"; echo "$dn -- $fn -- $f"; mkdir -p src/style/$dn; ln -sf ../../.`echo $f | grep -q / && echo '.'`/node_modules/cesium/Build/Cesium/Widgets/$dn/$fn src/style/$dn/$fn; done;

#!/bin/zsh

# Start from the current directory
base_dir="./dist"

# Find all directories (excluding node_modules) that contain a package.json file
find $base_dir -type d -name 'node_modules' -prune -o -type f -name 'package.json' -print0 | xargs -0 -n1 dirname | sort -u | while read dir; do
    echo "Running 'npm i' in $dir"
    cd $dir || continue
    npm i
    cd - >/dev/null
done
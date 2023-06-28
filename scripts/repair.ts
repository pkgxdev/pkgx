#!/bin/sh

exec deno task run +tea.xyz/brewkit pkg cellar --repair "$@"

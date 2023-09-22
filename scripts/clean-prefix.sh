for x in ~/.pkgx/*; do
  case $(basename "$x") in
  deno.land);;
  pkgx.sh);;
  *)
    rm -rf "$x"
  esac
done

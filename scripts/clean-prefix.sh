for x in ~/.tea/*; do
  case $(basename "$x") in
  deno.land);;
  tea.xyz);;
  *)
    rm -rf "$x"
  esac
done

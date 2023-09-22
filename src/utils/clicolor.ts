
export default function(dst = Deno.stdout.rid, env = Deno.env.toObject()) {
  // interprets https://no-color.org
  // see: https://deno.land/api@v1.37.1?s=Deno.noColor
  if (Deno.noColor) {
    return false
  }

  //https://bixense.com/clicolors/

  //NOTE we (mostly) only output colors to stderr hence the isatty check for that
  //FIXME not true for --help tho
  if (env.CLICOLOR !== '0' && Deno.isatty(dst)) {
    return true
  }
  if ((env.CLICOLOR_FORCE ?? '0') != '0') {
    //https://bixense.com/clicolors/
    return true
  }

  if (env.CLICOLOR == '0' || env.CLICOLOR_FORCE == '0') {
    return false
  }
  if (env.CI) {
    // this is what charm’s lipgloss does, we copy their lead
    // however surely nobody wants `pkgx foo > bar` to contain color codes?
    // the thing is otherwise we have no color in CI since it is not a TTY
    //TODO probs should check the value of some of the TERM vars
    return true
  }

  return false
}

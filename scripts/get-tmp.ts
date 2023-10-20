const { TMP, TMPDIR } = Deno.env.toObject()
const { os } = Deno.build
console.log(TMP || TMPDIR || (os == 'windows' ? 'c:\\windows\\temp' : '/tmp'))

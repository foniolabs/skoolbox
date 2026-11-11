// Types for `import logo from './logo.svg'` and friends. Next writes the same thing
// into next-env.d.ts, but that file is generated (and git-ignored), so a fresh
// checkout would fail to type-check until something had run `next build`.
import 'next/image-types/global'

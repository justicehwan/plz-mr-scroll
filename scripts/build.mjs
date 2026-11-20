// ESM 과 CommonJS 를 따로 컴파일한다. 묶지 않는다 — `plz-mr-scroll/react` 가 `plz-mr-scroll` 본체를 그대로 불러와야 장치가 하나만 돈다.
import { execFileSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });
for (const format of ["esm", "cjs"]) {
  execFileSync("npx", ["tsc", "-p", `tsconfig.${format}.json`], { stdio: "inherit", shell: process.platform === "win32" });
}
// 패키지는 "type": "module" 이라, CommonJS 쪽 폴더에는 그 폴더만의 표시가 필요하다.
writeFileSync("dist/cjs/package.json", '{ "type": "commonjs" }\n');

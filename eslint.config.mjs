import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local probe scripts (Mongo data inspection, dummy cleanup helpers).
    // Bukan source aplikasi — tidak perlu di-lint.
    "check-andi-uas.cjs",
    "probe-db.cjs",
    "probe-uas.cjs",
  ]),
  // ─── Project-wide rule overrides ─────────────────────────────────────────
  // Codebase ini di-bootstrap dengan pattern React 18 + TypeScript loose.
  // Migrasi ke Next 16 + React 19 memunculkan banyak warning yang sebenarnya
  // benign:
  //
  //   • react-hooks/set-state-in-effect — pattern setState() di mount-only
  //     effect (mis. fetch initial data) tidak menyebabkan cascading render
  //     berbahaya. Refactor proper-nya butuh re-architecture banyak halaman.
  //   • react-hooks/immutability — legacy "function declared after useEffect"
  //     pattern. Bekerja benar saat runtime, hanya stylistic warning.
  //   • @typescript-eslint/no-explicit-any — banyak catch (err: any) dan
  //     fetch response yang typing-nya akan progressive di-refactor.
  //   • react/no-unescaped-entities — quote di copywriting Bahasa Indonesia.
  //
  // Diturunkan jadi "warn" supaya tidak block dev/editor, tapi tetap
  // surface untuk dibersihkan bertahap.
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "react/no-unescaped-entities": "warn",
    },
  },
]);

export default eslintConfig;

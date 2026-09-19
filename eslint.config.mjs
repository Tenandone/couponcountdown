import globals from 'globals';
export default [{files:['**/*.mjs','**/*.js'],languageOptions:{ecmaVersion:'latest',sourceType:'module',globals:{...globals.node,...globals.browser}},rules:{'no-undef':'error','no-dupe-keys':'error','no-unreachable':'error','valid-typeof':'error'}}];

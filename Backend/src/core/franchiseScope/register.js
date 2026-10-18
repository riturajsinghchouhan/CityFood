// Imported first by app.js so the franchise scope plugin is on every schema before any model compiles.
import { registerFranchiseScopePlugin } from './franchiseScope.js';

registerFranchiseScopePlugin();

# Source model archive

Complete 656-GLB collection imported from `MakingWavesW/VELOCITY-RIFT-SPEEDBOUND`, branch `3d-glb-assets`, commit `2ff1fa3`. The original paths beneath `public/models/` are preserved here beneath `models/`, including external texture dependencies. These files are source assets, not Vite public assets.

`assets/runtime-models.json` selects the models actually used by Stage 2 and the three existing Stage 1 Hero files. `node scripts/stage-assets.mjs` copies that exact selection and referenced local textures to `public/models/`. The generated city/nature/platform folders are ignored by Git. `npm run dev` and `npm run build` stage them automatically. Existing Hero URLs remain unchanged.

Original Kenney and KayKit CC0 notices are distributed in `public/licenses/`. Pet models are archived for future use; the game's current Pet renderer is unchanged.

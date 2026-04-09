# Vehicle Photos

This directory is reserved for **real vehicle photos** (PNG/WebP with transparent background).

## Naming Convention

Each file must match the family `id` from `src/lib/vehicles/families.ts`:

```
gol.webp
voyage.webp
polo.webp
tcross.webp
kicks.webp
versa.webp
cactus.webp
uno.webp
mobi.webp
argo.webp
hb20s.webp
hb20.webp
etios.webp
prisma.webp
hyptec-ht.webp
```

## Specifications

- **Format**: WebP (preferred) or PNG
- **Background**: Transparent
- **Orientation**: Side profile, facing right
- **Size**: ~800×400px recommended (2:1 aspect ratio)
- **Max file size**: ≤150 KB per asset

## How to Activate

1. Place the photo file here (e.g. `gol.webp`).
2. Open `src/lib/vehicles/families.ts`.
3. Set the family's `photoSrc` field:

```ts
{ id: 'gol', ..., photoSrc: '/vehicles/photos/gol.webp' },
```

4. The resolver will automatically prefer the photo over the silhouette.

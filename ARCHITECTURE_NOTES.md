# NIRMANA — Architectural Visualization Technical Notes

## Design Direction & Palette
- **Identity**: Warm Contemporary Indian Residence across 4 storeys (`12` apartments: `1 BHK`, `2 BHK`, `3 BHK` on Floors 1–4).
- **Material Hierarchy**:
  - **Dominant**: Warm ivory lime-plaster walls (`#E6DDD0` with mineral troweled bump) & honed limestone large-format slabs (`#D5CBB9` with `4px` grout joints & roughness variation).
  - **Supporting**: Quarter-sawn natural oak (`#AE8353`) and smoked walnut (`#62412A`) joinery with grain orientation matching structural panel direction (horizontal vs. vertical maps).
  - **Restrained Accents**: Honed travertine (`#D1C4B0` with linear veins/pinholes), warm satin greige cabinetry (`#C8BEB0`), oatmeal bouclé upholstery (`#DCD2C1`), muted olive (`#676E55`) and warm taupe (`#918372`) textiles, brushed champagne brass hardware, and dark bronze window framing (`#302B26`).

## Architectural Construction & Area Reporting
- **Structural Proportions**: `3.2 m` floor-to-floor, `2.8 m` clear ceiling height, `0.25 m` slab thickness, `0.22 m` exterior walls, `0.12 m` internal partitions.
- **Area Separation**: `deriveMetrics()` computes `usableIndoorSqm` (interior rooms with wall allowance factor), `balconySqm` (private terraces/balconies), and `sharedCirculationSqm` (lobby, lift, stairwell, corridors) separately without inflating indoor figures.

## Rendering, Lighting & Approximations
- **Reflections**: Pre-filtered `RoomEnvironment` PMREM supplies crisp specular response across brushed champagne brass, dark bronze, ceramic ware, and glass. Mirror surfaces use high-metalness clearcoated `MeshPhysicalMaterial` reflecting the environment rather than real-time planar `Reflector` render passes to preserve interactive frame rates across all devices.
- **Grounding & Shadows**: On hardware WebGL, `PCFSoftShadowMap` directional shadows combine with radial floor contact shadow discs (`opacity: 0.54`). On CPU software WebGL (`SwiftShader`), shadow maps and MSAA are disabled while keeping identical scene geometry, `RoomEnvironment`, procedural PBR maps, and `afterDraw()` `fenceSync` frame pacing.
- **Daylight & Evening Modes**: Daylight balances `1.62` warm south directional sun with `0.68` sky/ground hemisphere fill (`toneMappingExposure = 0.94`). Evening shifts exterior light to twilight indigo (`0x131822`) and engages room point lights (`3.2` gain), ceiling coves, downlights, dining pendant, reading lamps, under-cabinet kitchen LED, and wardrobe-triggered interior LED strips.

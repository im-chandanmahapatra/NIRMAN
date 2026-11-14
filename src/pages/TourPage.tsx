import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  ChevronUp,
  Compass,
  DoorOpen,
  ExternalLink,
  Eye,
  EyeOff,
  Fan,
  HelpCircle,
  Home,
  Layers,
  Lightbulb,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Moon,
  RotateCcw,
  Sun,
  Sunset,
  Waves,
  X,
} from 'lucide-react';
import {
  ALL_FLOORS,
  ARCH,
  EXTERIOR_CAMERA_PRESETS,
  ExteriorPresetSpec,
  FanSpeed,
  FloorNumber,
  getApartmentsOnFloor,
  getApartmentSpec,
  LightingMode,
  ParsedTourUrlState,
  ROOFTOP_CAMERA_PRESETS,
  RooftopPresetSpec,
  serializeTourUrl,
  TourLevel,
  ViewMode,
} from '../architecture/buildingData';
import { Minimap } from '../components/Minimap';
import {
  createInitialInteractiveState,
  NirmanaTourEngine,
  ProjectedRoomLabel,
  TourInteractiveState,
} from '../engine/tourScene';

interface TourPageProps {
  initialState: ParsedTourUrlState;
}

type DockTab = 'residence' | 'views' | 'atmosphere' | 'interact';

function initialViewModeForLevel(level: TourLevel): ViewMode {
  if (level === 'apartment') return 'dollhouse';
  if (level === 'room') return 'walkthrough';
  return 'exterior';
}

export const TourPage: React.FC<TourPageProps> = ({ initialState }) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<NirmanaTourEngine | null>(null);
  const resetViewRef = useRef<() => void>(() => {});

  const [tourLevel, setTourLevel] = useState<TourLevel>(initialState.level);
  const [floor, setFloor] = useState<FloorNumber>(initialState.floor);
  const [aptId, setAptId] = useState<string>(initialState.aptId);
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    initialViewModeForLevel(initialState.level),
  );
  const [lightingMode, setLightingMode] = useState<LightingMode>(
    initialState.lighting,
  );
  const [anganUrl] = useState<string | null>(initialState.anganUrl);
  const [dockTab, setDockTab] = useState<DockTab>(() =>
    initialState.level === 'apartment' || initialState.level === 'room'
      ? 'views'
      : 'residence',
  );
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [showMinimap, setShowMinimap] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true,
  );
  const [showHelp, setShowHelp] = useState(false);
  const [activeRoom, setActiveRoom] = useState<{ id: string; name: string }>({
    id: initialState.roomId ?? 'foyer',
    name: 'Arrival Foyer',
  });
  const [activePresetId, setActivePresetId] = useState<string>(() => {
    const initApt = getApartmentSpec(initialState.floor, initialState.aptId);
    if (initialState.roomId) {
      const m =
        initApt.cameraPresets.find((p) => p.roomId === initialState.roomId) ??
        initApt.cameraPresets.find((p) => p.id === initialState.roomId);
      if (m) return m.id;
    }
    return 'arrival';
  });
  const [activeExteriorPreset, setActiveExteriorPreset] =
    useState<ExteriorPresetSpec['id']>('tower-34');
  const [activeRooftopPreset, setActiveRooftopPreset] =
    useState<RooftopPresetSpec['id']>('pool-overview');
  const [projectedLabels, setProjectedLabels] = useState<ProjectedRoomLabel[]>([]);
  const [playerPose, setPlayerPose] = useState<{
    x: number;
    z: number;
    yaw: number;
  }>({
    x: 4.46,
    z: -0.62,
    yaw: 0,
  });
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [transitionFade, setTransitionFade] = useState(false);
  const fadeTimerRef = useRef<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [ceilingVisible, setCeilingVisible] = useState(
    initialState.level === 'room' ||
      initialState.level === 'building' ||
      initialState.level === 'floor' ||
      initialState.level === 'rooftop',
  );
  const [roofVisible, setRoofVisible] = useState(
    initialState.level !== 'apartment',
  );
  const [interactive, setInteractive] = useState<TourInteractiveState>(
    createInitialInteractiveState,
  );

  const floorApartments = getApartmentsOnFloor(floor);
  const apt = getApartmentSpec(floor, aptId);

  const syncEnclosureFromEngine = useCallback(() => {
    if (!engineRef.current) return;
    const vis = engineRef.current.getEnclosureVisibility();
    setCeilingVisible(vis.ceiling);
    setRoofVisible(vis.roof);
  }, []);

  const enterRoomById = useCallback(
    (roomOrPresetId: string) => {
      const engine = engineRef.current;
      if (!engine) return;
      const currentApt = engine.getActiveApartment();
      const matchedPreset =
        currentApt.cameraPresets.find((p) => p.id === roomOrPresetId) ??
        currentApt.cameraPresets.find((p) => p.roomId === roomOrPresetId);
      setActivePresetId(matchedPreset?.id ?? roomOrPresetId);
      setTourLevel('room');
      setViewMode('walkthrough');
      setProjectedLabels([]);
      engine.enterRoom(roomOrPresetId, false);
      syncEnclosureFromEngine();
    },
    [syncEnclosureFromEngine],
  );

  const returnToApartmentLayout = useCallback(() => {
    setTourLevel('apartment');
    setViewMode('dollhouse');
    setDockTab('views');
    engineRef.current?.setTourLevel('apartment', false);
    syncEnclosureFromEngine();
  }, [syncEnclosureFromEngine]);

  // Keep browser query parameters synchronized with the active tour state
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const nextSearch = serializeTourUrl({
      level: tourLevel,
      floor,
      aptId: apt.id,
      roomId: tourLevel === 'room' ? activeRoom.id : null,
      lighting: lightingMode,
      anganUrl,
    });
    if (window.location.search !== nextSearch) {
      window.history.replaceState({}, '', `${window.location.pathname}${nextSearch}`);
    }
  }, [tourLevel, floor, apt.id, activeRoom.id, lightingMode, anganUrl]);

  // Mount WebGLRenderer & Scene ONCE
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new NirmanaTourEngine(
      container,
      initialState.floor,
      initialState.aptId,
      initialState.level,
      initialState.lighting,
      initialState.roomId,
      {
        onRoomChange: (id, name) => {
          setActiveRoom({ id, name });
          const currentApt = engineRef.current?.getActiveApartment();
          const matched = currentApt?.cameraPresets.find((p) => p.roomId === id);
          if (matched) setActivePresetId(matched.id);
        },
        onPlayerMove: (x, z, yaw) => setPlayerPose({ x, z, yaw }),
        onHoverChange: (label) => setHoverLabel(label),
        onContextLost: (lost) => setContextLost(lost),
        onRoomLabelsChange: (labels) => setProjectedLabels(labels),
        onSelectFloor: (fl) => {
          const active = engine.getActiveApartment();
          setFloor(fl);
          setAptId(active.id);
          setTourLevel('floor');
          setViewMode('exterior');
          setActivePresetId('arrival');
          setInteractive({ ...engine.getState() });
          const vis = engine.getEnclosureVisibility();
          setCeilingVisible(vis.ceiling);
          setRoofVisible(vis.roof);
        },
        onSelectRoomFromLayout: (roomId) => {
          const currentApt = engine.getActiveApartment();
          const matchedPreset =
            currentApt.cameraPresets.find((p) => p.roomId === roomId) ??
            currentApt.cameraPresets.find((p) => p.id === roomId);
          setActivePresetId(matchedPreset?.id ?? roomId);
          setTourLevel('room');
          setViewMode('walkthrough');
          setProjectedLabels([]);
          engine.enterRoom(roomId, false);
          const vis = engine.getEnclosureVisibility();
          setCeilingVisible(vis.ceiling);
          setRoofVisible(vis.roof);
        },
        onZoomOutToLayout: () => {
          setTourLevel('apartment');
          setViewMode('dollhouse');
          engine.setTourLevel('apartment', false);
          const vis = engine.getEnclosureVisibility();
          setCeilingVisible(vis.ceiling);
          setRoofVisible(vis.roof);
        },
        onTourLevelStepBack: (nextLevel, restoredViewMode) => {
          setTourLevel(nextLevel);
          setViewMode(restoredViewMode);
          if (nextLevel === 'apartment') {
            setDockTab('views');
          }
          const vis = engine.getEnclosureVisibility();
          setCeilingVisible(vis.ceiling);
          setRoofVisible(vis.roof);
        },
        onTransitionFade: () => {
          if (fadeTimerRef.current !== null) {
            window.clearTimeout(fadeTimerRef.current);
          }
          setTransitionFade(true);
          fadeTimerRef.current = window.setTimeout(() => {
            setTransitionFade(false);
            fadeTimerRef.current = null;
          }, 160);
        },
        onInteract: () => {
          setInteractive({ ...engine.getState() });
        },
      },
    );

    engineRef.current = engine;
    const spec = engine.getActiveApartment();
    setAptId(spec.id);
    setPlayerPose({
      x: spec.entryPoint[0],
      z: spec.entryPoint[2],
      yaw: 0,
    });
    const vis = engine.getEnclosureVisibility();
    setCeilingVisible(vis.ceiling);
    setRoofVisible(vis.roof);

    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      } else if (e.key === '?') {
        setShowHelp((prev) => !prev);
      } else if (e.key === 'r' || e.key === 'R') {
        resetViewRef.current();
      }
    };
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFsChange);

    return () => {
      if (fadeTimerRef.current !== null) {
        window.clearTimeout(fadeTimerRef.current);
      }
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFsChange);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleSelectFloor = (nextFloor: FloorNumber) => {
    const floorUnits = getApartmentsOnFloor(nextFloor);
    const keepTypeUnit =
      floorUnits.find((u) => u.type === apt.type) ?? floorUnits[0];
    setFloor(nextFloor);
    setAptId(keepTypeUnit.id);
    setActivePresetId('arrival');

    if (engineRef.current) {
      setIsSwitching(true);
      engineRef.current.loadApartment(nextFloor, keepTypeUnit.id, false);
      const nextApt = engineRef.current.getActiveApartment();
      setPlayerPose({
        x: nextApt.entryPoint[0],
        z: nextApt.entryPoint[2],
        yaw: 0,
      });
      setInteractive({ ...engineRef.current.getState() });

      if (tourLevel === 'building' || tourLevel === 'floor' || tourLevel === 'rooftop') {
        setTourLevel('floor');
        setViewMode('exterior');
        engineRef.current.focusFloor(nextFloor, false);
      } else if (tourLevel === 'apartment') {
        engineRef.current.setViewMode(viewMode, true);
      } else {
        engineRef.current.placeAtEntry(true);
        setActiveRoom({ id: 'foyer', name: 'Arrival Foyer' });
      }
      syncEnclosureFromEngine();
      requestAnimationFrame(() => setIsSwitching(false));
    }
  };

  const handleSelectUnit = (unitId: string, openLayoutIfExterior = false) => {
    const chosen = getApartmentSpec(floor, unitId);
    setAptId(chosen.id);
    setActivePresetId('arrival');
    if (engineRef.current) {
      setIsSwitching(true);
      engineRef.current.loadApartment(floor, chosen.id, true);
      const nextApt = engineRef.current.getActiveApartment();
      setPlayerPose({
        x: nextApt.entryPoint[0],
        z: nextApt.entryPoint[2],
        yaw: 0,
      });
      setActiveRoom({ id: 'foyer', name: 'Arrival Foyer' });
      setInteractive({ ...engineRef.current.getState() });

      if (openLayoutIfExterior || tourLevel === 'building' || tourLevel === 'floor' || tourLevel === 'rooftop') {
        setTourLevel('apartment');
        setViewMode('dollhouse');
        setDockTab('views');
        engineRef.current.setTourLevel('apartment', false);
      } else if (tourLevel === 'apartment') {
        engineRef.current.setViewMode(viewMode === 'floorplan' ? 'floorplan' : 'dollhouse', true);
      } else {
        engineRef.current.placeAtEntry(true);
      }
      syncEnclosureFromEngine();
      requestAnimationFrame(() => setIsSwitching(false));
    }
  };

  const handleTourLevel = (nextLevel: TourLevel, layoutMode?: 'dollhouse' | 'floorplan') => {
    setTourLevel(nextLevel);
    if (nextLevel === 'building') {
      setViewMode('exterior');
      setActiveExteriorPreset('tower-34');
      engineRef.current?.goToExteriorPreset('tower-34', false);
    } else if (nextLevel === 'floor') {
      setViewMode('exterior');
      engineRef.current?.focusFloor(floor, false);
    } else if (nextLevel === 'apartment') {
      const targetMode = layoutMode ?? (viewMode === 'floorplan' ? 'floorplan' : 'dollhouse');
      setViewMode(targetMode);
      setDockTab('views');
      engineRef.current?.setCeilingVisible(false);
      engineRef.current?.setRoofVisible(false);
      engineRef.current?.setViewMode(targetMode, false);
    } else if (nextLevel === 'room') {
      setViewMode('walkthrough');
      setDockTab('views');
      engineRef.current?.setTourLevel('room', false);
    } else if (nextLevel === 'rooftop') {
      setViewMode('exterior');
      setActiveRooftopPreset('pool-overview');
      setDockTab('views');
      engineRef.current?.goToRooftopPreset('pool-overview', false);
    }
    syncEnclosureFromEngine();
  };

  const handleExteriorPreset = (presetId: ExteriorPresetSpec['id']) => {
    setActiveExteriorPreset(presetId);
    setTourLevel('building');
    setViewMode('exterior');
    engineRef.current?.goToExteriorPreset(presetId, false);
    syncEnclosureFromEngine();
  };

  const handleRooftopPreset = (presetId: RooftopPresetSpec['id']) => {
    setActiveRooftopPreset(presetId);
    setTourLevel('rooftop');
    setViewMode('exterior');
    engineRef.current?.goToRooftopPreset(presetId, false);
    syncEnclosureFromEngine();
  };

  const handleLightingMode = (mode: LightingMode) => {
    setLightingMode(mode);
    engineRef.current?.setLightingMode(mode, false);
  };

  const handleResetView = () => {
    if (!engineRef.current) return;
    if (tourLevel === 'building') {
      setActiveExteriorPreset('tower-34');
      engineRef.current.goToExteriorPreset('tower-34', false);
    } else if (tourLevel === 'floor') {
      engineRef.current.focusFloor(floor, false);
    } else if (tourLevel === 'apartment') {
      engineRef.current.setViewMode(viewMode === 'floorplan' ? 'floorplan' : 'dollhouse', false);
    } else if (tourLevel === 'rooftop') {
      setActiveRooftopPreset('pool-overview');
      engineRef.current.goToRooftopPreset('pool-overview', false);
    } else {
      setActivePresetId('arrival');
      engineRef.current.placeAtEntry(false);
    }
    syncEnclosureFromEngine();
  };
  resetViewRef.current = handleResetView;

  const toggleCeilingVisibility = () => {
    const next = !ceilingVisible;
    engineRef.current?.setCeilingVisible(next);
    syncEnclosureFromEngine();
  };

  const toggleRoofVisibility = () => {
    const next = !roofVisible;
    engineRef.current?.setRoofVisible(next);
    syncEnclosureFromEngine();
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore fullscreen denial inside embedded preview iframes
    }
  };

  const toggleDoor = (doorId: string) => {
    engineRef.current?.updateInteractiveState((prev) => ({
      ...prev,
      doors: { ...prev.doors, [doorId]: !prev.doors[doorId] },
    }));
    if (engineRef.current) setInteractive({ ...engineRef.current.getState() });
  };

  const toggleCurtain = (curtainId: string) => {
    engineRef.current?.updateInteractiveState((prev) => ({
      ...prev,
      curtains: { ...prev.curtains, [curtainId]: !prev.curtains[curtainId] },
    }));
    if (engineRef.current) setInteractive({ ...engineRef.current.getState() });
  };

  const toggleDrawer = (drawerId: string) => {
    engineRef.current?.updateInteractiveState((prev) => ({
      ...prev,
      drawers: { ...prev.drawers, [drawerId]: !prev.drawers[drawerId] },
    }));
    if (engineRef.current) setInteractive({ ...engineRef.current.getState() });
  };

  const toggleHinged = (hingedId: string) => {
    engineRef.current?.updateInteractiveState((prev) => ({
      ...prev,
      hinged: { ...prev.hinged, [hingedId]: !prev.hinged[hingedId] },
    }));
    if (engineRef.current) setInteractive({ ...engineRef.current.getState() });
  };

  const toggleWardrobe = () => {
    engineRef.current?.updateInteractiveState((prev) => ({
      ...prev,
      wardrobeOpen: !prev.wardrobeOpen,
    }));
    if (engineRef.current) setInteractive({ ...engineRef.current.getState() });
  };

  const toggleLocker = () => {
    engineRef.current?.updateInteractiveState((prev) => ({
      ...prev,
      lockerOpen: !prev.lockerOpen,
      wardrobeOpen: !prev.lockerOpen ? true : prev.wardrobeOpen,
    }));
    if (engineRef.current) setInteractive({ ...engineRef.current.getState() });
  };

  const toggleRoomLight = (roomId: string) => {
    engineRef.current?.updateInteractiveState((prev) => ({
      ...prev,
      roomLights: {
        ...prev.roomLights,
        [roomId]: !(prev.roomLights[roomId] ?? true),
      },
    }));
    if (engineRef.current) setInteractive({ ...engineRef.current.getState() });
  };

  const toggleLamp = (lampId: string) => {
    engineRef.current?.updateInteractiveState((prev) => ({
      ...prev,
      lamps: { ...prev.lamps, [lampId]: !(prev.lamps[lampId] ?? true) },
    }));
    if (engineRef.current) setInteractive({ ...engineRef.current.getState() });
  };

  const setFanSpeed = (roomId: string, speed: FanSpeed) => {
    engineRef.current?.updateInteractiveState((prev) => ({
      ...prev,
      fanSpeeds: { ...prev.fanSpeeds, [roomId]: speed },
    }));
    if (engineRef.current) setInteractive({ ...engineRef.current.getState() });
  };

  const isLayoutMode =
    tourLevel === 'apartment' &&
    (viewMode === 'dollhouse' || viewMode === 'floorplan');

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-[#DCE4EC] select-none"
      data-tour-level={tourLevel}
      data-view-mode={viewMode}
      data-lighting={lightingMode}
      data-floor={floor}
      data-apartment={apt.id}
      data-room={activeRoom.id}
      data-ceiling-visible={ceilingVisible}
      data-roof-visible={roofVisible}
    >
      {/* Dedicated WebGL Mount Container */}
      <div
        ref={mountRef}
        data-testid="tour-canvas-container"
        className="absolute inset-0 w-full h-full"
      />

      {/* Brief Cross-Wall / Shell Transition Fade (respects reduced motion) */}
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 z-10 bg-[#EDE7DD] transition-opacity duration-150 motion-reduce:hidden ${
          transitionFade ? 'opacity-45' : 'opacity-0'
        }`}
      />

      {/* Projected 2D HTML Room Labels in Apartment Layout View */}
      {isLayoutMode && projectedLabels.length > 0 && (
        <div
          className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
          aria-label="Interactive apartment room labels"
        >
          {projectedLabels.map((lbl) => (
            <button
              key={lbl.id}
              type="button"
              onClick={() => enterRoomById(lbl.id)}
              style={{ left: `${lbl.x}px`, top: `${lbl.y}px` }}
              className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 rounded-md bg-[#FAF7F1]/92 hover:bg-[#2D2822] text-[#2D2822] hover:text-[#FAF7F1] border border-[#C6BCAE] text-[11px] font-medium shadow-sm transition-colors whitespace-nowrap cursor-pointer"
            >
              {lbl.name}
            </button>
          ))}
        </div>
      )}

      {/* WebGL Context Loss Fallback */}
      {contextLost && (
        <div className="absolute inset-0 z-50 bg-[#F6F2EA] flex items-center justify-center p-8 text-center">
          <div>
            <h2 className="font-display text-3xl mb-2">3D Viewport Paused</h2>
            <p className="text-sm text-[#5C5347] mb-4">
              Graphics context was suspended. Reload the viewport to continue exploring NIRMAN.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-[#6E755B] text-white rounded-lg text-sm cursor-pointer"
            >
              Reload Viewport
            </button>
          </div>
        </div>
      )}

      {/* Compact Top HUD */}
      <div className="pointer-events-none fixed top-2.5 inset-x-2.5 sm:top-3.5 sm:inset-x-4 z-20 flex items-start justify-between gap-2">
        {/* Top-Left Brand + Hierarchical Breadcrumb + Back to Apartment */}
        <div className="pointer-events-auto flex flex-col items-start gap-1.5 min-w-0 max-w-[66vw] sm:max-w-none">
          <div className="flex items-center gap-1 sm:gap-1.5 bg-[#FAF7F1]/95 border border-[#D8D0C3] rounded-xl px-2.5 sm:px-3 py-1.5 shadow-sm min-w-0 max-w-full overflow-x-auto">
            {anganUrl && (
              <a
                href={anganUrl}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#4E463C] hover:text-[#1F1C18] pr-2 border-r border-[#DFD7C8] whitespace-nowrap shrink-0"
              >
                <ArrowLeft className="w-3 h-3" aria-hidden="true" />
                <span>Back to ANGAN</span>
                <ExternalLink className="w-2.5 h-2.5 opacity-60" aria-hidden="true" />
              </a>
            )}

            <button
              type="button"
              onClick={() => handleTourLevel('building')}
              className="font-display text-sm sm:text-base font-semibold tracking-wider text-[#1F1C18] hover:text-[#5B768B] cursor-pointer whitespace-nowrap shrink-0"
              title="NIRMAN Building Overview"
            >
              NIRMAN
            </button>

            <span className="text-[#B4AA9B] text-xs" aria-hidden="true">
              /
            </span>

            <button
              type="button"
              onClick={() => handleTourLevel('floor')}
              className={`text-xs whitespace-nowrap cursor-pointer rounded px-1 py-0.5 ${
                tourLevel === 'floor'
                  ? 'font-semibold text-[#1F1C18] bg-[#EAE3D5]'
                  : 'text-[#4E463C] hover:text-[#1F1C18]'
              }`}
            >
              <span className="sm:hidden">F{floor}</span>
              <span className="hidden sm:inline">Floor {floor}</span>
            </button>

            {(tourLevel === 'apartment' || tourLevel === 'room') && (
              <>
                <span className="text-[#B4AA9B] text-xs" aria-hidden="true">
                  /
                </span>
                <button
                  type="button"
                  onClick={returnToApartmentLayout}
                  className={`text-xs whitespace-nowrap cursor-pointer rounded px-1 py-0.5 ${
                    tourLevel === 'apartment'
                      ? 'font-semibold text-[#1F1C18] bg-[#EAE3D5]'
                      : 'text-[#4E463C] hover:text-[#1F1C18]'
                  }`}
                >
                  Unit {apt.unitNumber} ({apt.type})
                </button>
              </>
            )}

            {tourLevel === 'room' && (
              <>
                <span className="hidden sm:inline text-[#B4AA9B] text-xs" aria-hidden="true">
                  /
                </span>
                <span className="hidden sm:inline text-xs font-medium text-[#5B768B] whitespace-nowrap truncate">
                  {isSwitching ? 'Loading...' : activeRoom.name}
                </span>
              </>
            )}

            {tourLevel === 'rooftop' && (
              <>
                <span className="text-[#B4AA9B] text-xs" aria-hidden="true">
                  /
                </span>
                <span className="text-xs font-semibold text-[#3C6C8C] whitespace-nowrap">
                  Rooftop Pool
                </span>
              </>
            )}

            <button
              type="button"
              onClick={handleResetView}
              aria-label="Reset camera for current view"
              title="Reset View (R)"
              className="ml-0.5 p-1 text-[#5C5347] hover:text-[#1F1C18] rounded-md hover:bg-[#EDE7DC] cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          {tourLevel !== 'building' && (
            <button
              type="button"
              onClick={() => engineRef.current?.stepBackLevel()}
              className="inline-flex items-center gap-1.5 bg-[#2D2822] hover:bg-[#1F1C18] text-[#FAF7F1] border border-[#494239] rounded-lg px-3 py-1.5 text-xs font-medium shadow-md cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {tourLevel === 'room'
                  ? 'Back to apartment'
                  : tourLevel === 'apartment'
                    ? `Back to Floor ${floor}`
                    : 'Back to building'}
              </span>
            </button>
          )}
        </div>

        {/* Top-Right Lighting + Map + Help + Fullscreen + Minimap */}
        <div className="pointer-events-auto flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-1 sm:gap-1.5">
            <div
              role="group"
              aria-label="Scene lighting atmosphere"
              className="flex items-center gap-0.5 bg-[#FAF7F1]/95 border border-[#D8D0C3] rounded-lg p-0.5 shadow-sm"
            >
              {(
                [
                  { id: 'morning', label: 'Morning', icon: Sun, iconClass: 'text-[#A87C3B]' },
                  { id: 'evening', label: 'Evening', icon: Sunset, iconClass: 'text-[#B8683C]' },
                  { id: 'night', label: 'Night', icon: Moon, iconClass: 'text-[#495B7A]' },
                ] as const
              ).map((lm) => {
                const Icon = lm.icon;
                const active = lightingMode === lm.id;
                return (
                  <button
                    key={lm.id}
                    type="button"
                    onClick={() => handleLightingMode(lm.id)}
                    aria-pressed={active}
                    aria-label={`${lm.label} lighting`}
                    className={`inline-flex items-center gap-1 rounded-md px-1.5 sm:px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-[#2D2822] text-[#F7F4EE]'
                        : 'text-[#4E463C] hover:bg-[#EFEAE0]'
                    }`}
                  >
                    <Icon
                      className={`w-3.5 h-3.5 ${active ? 'text-[#F2D194]' : lm.iconClass}`}
                      aria-hidden="true"
                    />
                    <span className={active ? 'inline' : 'hidden sm:inline'}>{lm.label}</span>
                  </button>
                );
              })}
            </div>

            {(tourLevel === 'apartment' || tourLevel === 'room') && (
              <button
                type="button"
                onClick={() => setShowMinimap((m) => !m)}
                aria-label={showMinimap ? 'Hide floorplan minimap' : 'Show floorplan minimap'}
                className="inline-flex items-center gap-1 bg-[#FAF7F1]/95 border border-[#D8D0C3] rounded-lg px-2 py-1.5 text-xs font-medium text-[#2D2822] hover:bg-[#EFEAE0] shadow-sm cursor-pointer"
              >
                <MapIcon className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Map</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowHelp((h) => !h)}
              aria-label="Toggle navigation help"
              aria-expanded={showHelp}
              title="Navigation Help (?)"
              className={`inline-flex items-center justify-center border rounded-lg p-1.5 text-xs font-medium shadow-sm cursor-pointer ${
                showHelp
                  ? 'bg-[#2D2822] border-[#2D2822] text-[#FAF7F1]'
                  : 'bg-[#FAF7F1]/95 border-[#D8D0C3] text-[#2D2822] hover:bg-[#EFEAE0]'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              className="hidden sm:inline-flex items-center justify-center bg-[#FAF7F1]/95 border border-[#D8D0C3] rounded-lg p-1.5 text-xs font-medium text-[#2D2822] hover:bg-[#EFEAE0] shadow-sm cursor-pointer"
            >
              {isFullscreen ? (
                <Minimize2 className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
              )}
            </button>
          </div>

          {showHelp && (
            <div className="w-64 sm:w-72 bg-[#FAF7F1]/96 border border-[#D8D0C3] rounded-xl p-3 shadow-lg text-xs text-[#3D362D]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-[#1F1C18]">NIRMAN 3D Controls</span>
                <button
                  type="button"
                  onClick={() => setShowHelp(false)}
                  aria-label="Close help"
                  className="p-0.5 rounded hover:bg-[#EAE3D5] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <ul className="space-y-1 text-[11px] leading-relaxed text-[#574E42]">
                <li>• <strong>Building &amp; Floor:</strong> Drag to orbit, scroll to zoom, click any floor slab 1–10.</li>
                <li>• <strong>Apartment Layout:</strong> Click any room label or floor footprint to enter eye-level view.</li>
                <li>• <strong>Room Walkthrough:</strong> WASD / Arrows to walk, drag to look, click doors, curtains, wardrobe, or Puja diya.</li>
                <li>• <strong>Step Back:</strong> Scroll out or click <em>Back to apartment</em>. Press <strong>H</strong> to hide dock, <strong>R</strong> to reset.</li>
              </ul>
            </div>
          )}

          {showMinimap && (tourLevel === 'apartment' || tourLevel === 'room') && (
            <Minimap
              apartment={apt}
              playerX={playerPose.x}
              playerZ={playerPose.z}
              playerYaw={playerPose.yaw}
              activeRoomId={activeRoom.id}
              onSelectRoom={enterRoomById}
            />
          )}
        </div>
      </div>

      {/* Subtle Hover Interaction Hint */}
      {hoverLabel && (
        <div className="pointer-events-none fixed left-1/2 top-16 -translate-x-1/2 z-20 bg-[#221F1B]/90 text-[#F7F4EE] text-xs px-3 py-1.5 rounded-lg shadow">
          Click: {hoverLabel}
        </div>
      )}

      {/* Mobile / Touch Walkthrough D-Pad */}
      {tourLevel === 'room' && !dockCollapsed && (
        <div className="md:hidden fixed left-3 top-24 z-20 grid grid-cols-3 gap-1 bg-[#FAF7F1]/92 border border-[#D8D0C3] p-1 rounded-xl shadow-sm">
          <div />
          <button
            type="button"
            aria-label="Walk forward"
            onPointerDown={() => engineRef.current?.setTouchMove(0, 1)}
            onPointerUp={() => engineRef.current?.setTouchMove(0, 0)}
            onPointerLeave={() => engineRef.current?.setTouchMove(0, 0)}
            className="w-8 h-8 rounded-lg bg-[#EDE7DC] text-xs font-semibold flex items-center justify-center"
          >
            ↑
          </button>
          <div />
          <button
            type="button"
            aria-label="Strafe left"
            onPointerDown={() => engineRef.current?.setTouchMove(-1, 0)}
            onPointerUp={() => engineRef.current?.setTouchMove(0, 0)}
            onPointerLeave={() => engineRef.current?.setTouchMove(0, 0)}
            className="w-8 h-8 rounded-lg bg-[#EDE7DC] text-xs font-semibold flex items-center justify-center"
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Walk backward"
            onPointerDown={() => engineRef.current?.setTouchMove(0, -1)}
            onPointerUp={() => engineRef.current?.setTouchMove(0, 0)}
            onPointerLeave={() => engineRef.current?.setTouchMove(0, 0)}
            className="w-8 h-8 rounded-lg bg-[#EDE7DC] text-xs font-semibold flex items-center justify-center"
          >
            ↓
          </button>
          <button
            type="button"
            aria-label="Strafe right"
            onPointerDown={() => engineRef.current?.setTouchMove(1, 0)}
            onPointerUp={() => engineRef.current?.setTouchMove(0, 0)}
            onPointerLeave={() => engineRef.current?.setTouchMove(0, 0)}
            className="w-8 h-8 rounded-lg bg-[#EDE7DC] text-xs font-semibold flex items-center justify-center"
          >
            →
          </button>
        </div>
      )}

      {/* Collapsible Unified Bottom Control Dock */}
      <div
        className={`fixed left-1/2 -translate-x-1/2 z-30 w-[min(960px,95vw)] transition-transform duration-200 ${
          dockCollapsed ? 'bottom-3 translate-y-[calc(100%-34px)]' : 'bottom-3 sm:bottom-4 translate-y-0'
        }`}
      >
        <div className="flex justify-center mb-1">
          <button
            type="button"
            onClick={() => setDockCollapsed((c) => !c)}
            aria-label={dockCollapsed ? 'Show tour controls' : 'Hide tour controls'}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FAF7F1]/95 border border-[#D8D0C3] rounded-lg text-[11px] font-medium text-[#4E463C] hover:text-[#1F1C18] shadow-sm cursor-pointer"
          >
            {dockCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Show Controls (H)</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Hide Controls (H)</span>
              </>
            )}
          </button>
        </div>

        <div className="bg-[#FAF7F1]/96 border border-[#D8D0C3] rounded-xl shadow-xl p-2.5 sm:p-3 max-h-[42vh] overflow-y-auto">
          {/* Dock Navigation Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#E5DDD0]">
            <div className="flex flex-wrap items-center gap-1">
              {(
                [
                  { id: 'residence', label: 'Floors & Units', icon: Home },
                  { id: 'views', label: 'Rooms & Views', icon: Compass },
                  { id: 'atmosphere', label: 'Lights & Fans', icon: Lightbulb },
                  { id: 'interact', label: 'Doors & Storage', icon: DoorOpen },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const active = dockTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setDockTab(tab.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-[#2D2822] text-[#F7F4EE]'
                        : 'text-[#4E463C] hover:bg-[#EDE7DC]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Primary Hierarchy & View Mode Switcher */}
            <div className="flex flex-wrap items-center gap-1 bg-[#EDE7DC] p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => handleTourLevel('building')}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer ${
                  tourLevel === 'building'
                    ? 'bg-[#5B768B] text-[#FAF7F1]'
                    : 'text-[#4E463C] hover:text-[#1F1C18]'
                }`}
              >
                <Building2 className="w-3 h-3" aria-hidden="true" />
                <span>Building</span>
              </button>
              <button
                type="button"
                onClick={() => handleTourLevel('floor')}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer ${
                  tourLevel === 'floor'
                    ? 'bg-[#5B768B] text-[#FAF7F1]'
                    : 'text-[#4E463C] hover:text-[#1F1C18]'
                }`}
              >
                <Layers className="w-3 h-3" aria-hidden="true" />
                <span>Floor {floor}</span>
              </button>
              <button
                type="button"
                onClick={() => handleTourLevel('apartment', 'dollhouse')}
                className={`px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer ${
                  tourLevel === 'apartment' && viewMode === 'dollhouse'
                    ? 'bg-[#6E755B] text-[#FAF7F1]'
                    : 'text-[#4E463C] hover:text-[#1F1C18]'
                }`}
              >
                Layout 3D
              </button>
              <button
                type="button"
                onClick={() => handleTourLevel('apartment', 'floorplan')}
                className={`px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer ${
                  tourLevel === 'apartment' && viewMode === 'floorplan'
                    ? 'bg-[#6E755B] text-[#FAF7F1]'
                    : 'text-[#4E463C] hover:text-[#1F1C18]'
                }`}
              >
                Top Plan
              </button>
              <button
                type="button"
                onClick={() => handleTourLevel('room')}
                className={`px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer ${
                  tourLevel === 'room'
                    ? 'bg-[#6E755B] text-[#FAF7F1]'
                    : 'text-[#4E463C] hover:text-[#1F1C18]'
                }`}
              >
                Walkthrough
              </button>
              <button
                type="button"
                onClick={() => handleTourLevel('rooftop')}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer ${
                  tourLevel === 'rooftop'
                    ? 'bg-[#3C6C8C] text-[#FAF7F1]'
                    : 'text-[#4E463C] hover:text-[#1F1C18]'
                }`}
              >
                <Waves className="w-3 h-3" aria-hidden="true" />
                <span>Rooftop Pool</span>
              </button>
            </div>
          </div>

          {/* Tab Panel Content */}
          <div className="pt-2">
            {dockTab === 'residence' && (
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    role="group"
                    aria-label="Select floor 1 to 10"
                    className="grid grid-cols-5 sm:grid-cols-10 gap-1 bg-[#EDE7DC] p-1 rounded-lg"
                  >
                    {ALL_FLOORS.map((fl) => (
                      <button
                        key={fl}
                        type="button"
                        onClick={() => handleSelectFloor(fl)}
                        className={`px-2 py-1 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                          floor === fl
                            ? 'bg-[#2D2822] text-[#F7F4EE]'
                            : 'text-[#4E463C] hover:text-[#1F1C18]'
                        }`}
                      >
                        F{fl}
                      </button>
                    ))}
                  </div>

                  {/* Floor-accurate apartment selector (only actual units on selected floor) */}
                  <div
                    role="group"
                    aria-label={`Apartments on Floor ${floor}`}
                    className="flex flex-wrap items-center gap-1 bg-[#EDE7DC] p-1 rounded-lg"
                  >
                    {floorApartments.map((unit) => {
                      const active = apt.id === unit.id;
                      const bhkText =
                        unit.type === '1BHK'
                          ? '1 BHK'
                          : unit.type === '2BHK'
                            ? '2 BHK'
                            : '3 BHK';
                      return (
                        <button
                          key={unit.id}
                          type="button"
                          onClick={() => handleSelectUnit(unit.id, true)}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer whitespace-nowrap ${
                            active
                              ? 'bg-[#6E755B] text-[#F7F4EE]'
                              : 'text-[#4E463C] hover:text-[#1F1C18]'
                          }`}
                        >
                          {unit.unitNumber} · {bhkText}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 text-xs text-[#4E463C] font-mono-tabular">
                  <span>{apt.title}</span>
                  <span>+{((floor - 1) * ARCH.FLOOR_HEIGHT).toFixed(1)}m</span>
                  <span>Indoor {apt.metrics.usableIndoorSqm} m²</span>
                  <span>Balcony {apt.metrics.balconySqm} m²</span>
                </div>
              </div>
            )}

            {dockTab === 'views' && (
              <div className="flex flex-wrap items-center gap-1.5">
                {(tourLevel === 'building' || tourLevel === 'floor') &&
                  EXTERIOR_CAMERA_PRESETS.map((ep) => (
                    <button
                      key={ep.id}
                      type="button"
                      onClick={() => handleExteriorPreset(ep.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap cursor-pointer ${
                        activeExteriorPreset === ep.id && tourLevel === 'building'
                          ? 'bg-[#2D2822] border-[#2D2822] text-[#F7F4EE]'
                          : 'bg-white/70 border-[#DFD7C8] text-[#4E463C] hover:border-[#A89E8E]'
                      }`}
                    >
                      {ep.label}
                    </button>
                  ))}

                {tourLevel === 'rooftop' &&
                  ROOFTOP_CAMERA_PRESETS.map((rp) => (
                    <button
                      key={rp.id}
                      type="button"
                      onClick={() => handleRooftopPreset(rp.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap cursor-pointer ${
                        activeRooftopPreset === rp.id
                          ? 'bg-[#3C6C8C] border-[#3C6C8C] text-[#FAF7F1]'
                          : 'bg-white/70 border-[#DFD7C8] text-[#4E463C] hover:border-[#A89E8E]'
                      }`}
                    >
                      {rp.label}
                    </button>
                  ))}

                {(tourLevel === 'apartment' || tourLevel === 'room') &&
                  apt.cameraPresets.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => enterRoomById(p.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap cursor-pointer ${
                        activePresetId === p.id && tourLevel === 'room'
                          ? 'bg-[#EFEAE0] border-[#6E755B] text-[#1F1C18]'
                          : 'bg-white/70 border-[#DFD7C8] text-[#4E463C] hover:border-[#A89E8E]'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}

                {tourLevel === 'apartment' && (
                  <>
                    <button
                      type="button"
                      onClick={toggleCeilingVisibility}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer whitespace-nowrap ${
                        ceilingVisible
                          ? 'bg-[#EFEAE0] border-[#6E755B] text-[#1F1C18]'
                          : 'bg-white/70 border-[#DFD7C8] text-[#4E463C]'
                      }`}
                    >
                      {ceilingVisible ? (
                        <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                      <span>Ceiling: {ceilingVisible ? 'On' : 'Cut'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={toggleRoofVisibility}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer whitespace-nowrap ${
                        roofVisible
                          ? 'bg-[#EFEAE0] border-[#6E755B] text-[#1F1C18]'
                          : 'bg-white/70 border-[#DFD7C8] text-[#4E463C]'
                      }`}
                    >
                      {roofVisible ? (
                        <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                      <span>Upper Floors: {roofVisible ? 'On' : 'Cut'}</span>
                    </button>
                  </>
                )}

                {(tourLevel === 'building' || tourLevel === 'floor') && (
                  <button
                    type="button"
                    onClick={() => handleTourLevel('apartment', 'dollhouse')}
                    className="ml-auto px-3 py-1.5 rounded-lg text-xs font-medium bg-[#6E755B] text-[#FAF7F1] hover:bg-[#5E644D] cursor-pointer whitespace-nowrap"
                  >
                    Inspect Unit {apt.unitNumber} Layout
                  </button>
                )}
              </div>
            )}

            {dockTab === 'atmosphere' && (
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: 'living', label: 'Living Lights' },
                    { id: 'kitchen', label: 'Kitchen Lights' },
                    { id: 'puja', label: 'Puja Lights' },
                    { id: 'primary-bed', label: 'Master Bed' },
                    { id: 'primary-bath', label: 'Bath Lights' },
                  ].map((rl) => {
                    const isOn = interactive.roomLights[rl.id] ?? true;
                    return (
                      <button
                        key={rl.id}
                        type="button"
                        onClick={() => toggleRoomLight(rl.id)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                          isOn
                            ? 'bg-[#EFEAE0] border-[#6E755B] text-[#1F1C18]'
                            : 'bg-white/50 border-[#DFD7C8] text-[#7D7366]'
                        }`}
                      >
                        {rl.label}: {isOn ? 'On' : 'Off'}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => toggleLamp('puja-diya')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                      interactive.lamps['puja-diya']
                        ? 'bg-[#EFEAE0] border-[#6E755B] text-[#1F1C18]'
                        : 'bg-white/50 border-[#DFD7C8] text-[#7D7366]'
                    }`}
                  >
                    Puja Diya: {interactive.lamps['puja-diya'] ? 'Lit' : 'Off'}
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleLamp('bed-lamp-l')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                      interactive.lamps['bed-lamp-l']
                        ? 'bg-[#EFEAE0] border-[#6E755B] text-[#1F1C18]'
                        : 'bg-white/50 border-[#DFD7C8] text-[#7D7366]'
                    }`}
                  >
                    Reading Lamp: {interactive.lamps['bed-lamp-l'] ? 'On' : 'Off'}
                  </button>
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                  <Fan className="w-3.5 h-3.5 text-[#5C5347]" aria-hidden="true" />
                  <span className="text-[#5C5347]">Living Fan:</span>
                  {([0, 1, 2, 3] as FanSpeed[]).map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => setFanSpeed('living', spd)}
                      className={`px-2 py-1 rounded-md text-xs font-medium cursor-pointer ${
                        interactive.fanSpeeds.living === spd
                          ? 'bg-[#6E755B] text-white'
                          : 'bg-[#EDE7DC] text-[#4E463C]'
                      }`}
                    >
                      {spd === 0 ? 'Off' : spd === 1 ? 'Low' : spd === 2 ? 'Med' : 'High'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {dockTab === 'interact' && (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => toggleDoor('entrance-door')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                    interactive.doors['entrance-door']
                      ? 'bg-[#EFEAE0] border-[#6E755B] text-[#1F1C18]'
                      : 'bg-white/70 border-[#DFD7C8] text-[#4E463C]'
                  }`}
                >
                  Entrance Door: {interactive.doors['entrance-door'] ? 'Open' : 'Closed'}
                </button>
                <button
                  type="button"
                  onClick={() => toggleDoor('balcony-door')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                    interactive.doors['balcony-door']
                      ? 'bg-[#EFEAE0] border-[#6E755B] text-[#1F1C18]'
                      : 'bg-white/70 border-[#DFD7C8] text-[#4E463C]'
                  }`}
                >
                  Balcony Slider: {interactive.doors['balcony-door'] ? 'Open' : 'Closed'}
                </button>
                {apt.type === '2BHK' && (
                  <button
                    type="button"
                    onClick={() => toggleDoor('utility-door')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                      interactive.doors['utility-door']
                        ? 'bg-[#EFEAE0] border-[#6E755B] text-[#1F1C18]'
                        : 'bg-white/70 border-[#DFD7C8] text-[#4E463C]'
                    }`}
                  >
                    Utility Door: {interactive.doors['utility-door'] ? 'Open' : 'Closed'}
                  </button>
                )}
                {apt.type === '3BHK' && (
                  <button
                    type="button"
                    onClick={() => toggleDoor('attached-bath-2-door')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                      interactive.doors['attached-bath-2-door']
                        ? 'bg-[#EFEAE0] border-[#6E755B] text-[#1F1C18]'
                        : 'bg-white/70 border-[#DFD7C8] text-[#4E463C]'
                    }`}
                  >
                    Bath 2 Door: {interactive.doors['attached-bath-2-door'] ? 'Open' : 'Closed'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => toggleCurtain('living-curtains')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                    interactive.curtains['living-curtains']
                      ? 'bg-[#EFEAE0] border-[#6E755B] text-[#1F1C18]'
                      : 'bg-white/70 border-[#DFD7C8] text-[#4E463C]'
                  }`}
                >
                  Living Curtains: {interactive.curtains['living-curtains'] ? 'Open' : 'Closed'}
                </button>
                <button
                  type="button"
                  onClick={() => toggleCurtain('bed1-curtains')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                    interactive.curtains['bed1-curtains']
                      ? 'bg-[#EFEAE0] border-[#6E755B] text-[#1F1C18]'
                      : 'bg-white/70 border-[#DFD7C8] text-[#4E463C]'
                  }`}
                >
                  Bed Curtains: {interactive.curtains['bed1-curtains'] ? 'Open' : 'Closed'}
                </button>
                <button
                  type="button"
                  onClick={() => toggleDrawer('kitchen-drawer')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                    interactive.drawers['kitchen-drawer']
                      ? 'bg-[#EFEAE0] border-[#6E755B] text-[#1F1C18]'
                      : 'bg-white/70 border-[#DFD7C8] text-[#4E463C]'
                  }`}
                >
                  Cutlery Drawer: {interactive.drawers['kitchen-drawer'] ? 'Open' : 'Closed'}
                </button>
                <button
                  type="button"
                  onClick={() => toggleHinged('sink-cabinet')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                    interactive.hinged['sink-cabinet']
                      ? 'bg-[#EFEAE0] border-[#6E755B] text-[#1F1C18]'
                      : 'bg-white/70 border-[#DFD7C8] text-[#4E463C]'
                  }`}
                >
                  Sink Cabinet: {interactive.hinged['sink-cabinet'] ? 'Open' : 'Closed'}
                </button>
                <button
                  type="button"
                  onClick={() => toggleHinged('upper-cabinet')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                    interactive.hinged['upper-cabinet']
                      ? 'bg-[#EFEAE0] border-[#6E755B] text-[#1F1C18]'
                      : 'bg-white/70 border-[#DFD7C8] text-[#4E463C]'
                  }`}
                >
                  Wall Cabinet: {interactive.hinged['upper-cabinet'] ? 'Open' : 'Closed'}
                </button>
                <button
                  type="button"
                  onClick={toggleWardrobe}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                    interactive.wardrobeOpen
                      ? 'bg-[#EFEAE0] border-[#6E755B] text-[#1F1C18]'
                      : 'bg-white/70 border-[#DFD7C8] text-[#4E463C]'
                  }`}
                >
                  Wardrobe: {interactive.wardrobeOpen ? 'Open' : 'Closed'}
                </button>
                <button
                  type="button"
                  onClick={toggleLocker}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                    interactive.lockerOpen
                      ? 'bg-[#EFEAE0] border-[#6E755B] text-[#1F1C18]'
                      : 'bg-white/70 border-[#DFD7C8] text-[#4E463C]'
                  }`}
                >
                  Locker: {interactive.lockerOpen ? 'Open' : 'Closed'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

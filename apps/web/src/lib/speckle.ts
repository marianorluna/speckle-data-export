/**
 * Adapter around @speckle/viewer (v2.x extensions API).
 * Selection uses Revit UniqueId stored as Speckle ``applicationId``.
 */

import {
  CameraController,
  DefaultViewerParams,
  FilteringExtension,
  MeasurementsExtension,
  SectionOutlines,
  SectionTool,
  SelectionExtension,
  SpeckleLoader,
  UrlHelper,
  Viewer,
  ViewerEvent,
  type SelectionEvent,
  type TreeNode,
} from "@speckle/viewer";

let viewerInstance: Viewer | null = null;
let cameraController: CameraController | null = null;
let selectionExtension: SelectionExtension | null = null;
let filteringExtension: FilteringExtension | null = null;
let measurementsExtension: MeasurementsExtension | null = null;
let sectionTool: SectionTool | null = null;
/** Speckle defaults to SmoothOrbitControls ("free orbit"). */
let freeOrbitActive = true;

export type ViewerInitOptions = {
  container: HTMLElement;
  serverUrl: string;
  streamId: string;
  /** Speckle commit id (from KPIs ``last_commit_id``). */
  commitId?: string | null;
  authToken?: string;
};

export type ViewerToolMode = "none" | "measure" | "section";

export type CanonicalCameraView = "top" | "front" | "left" | "back" | "right";

export type CameraUiState = {
  orthographic: boolean;
  /** Orbit (free orbit) vs fly controls. */
  freeOrbit: boolean;
};

function isOrthographicCamera(camera: object): boolean {
  return (
    "isOrthographicCamera" in camera &&
    (camera as { isOrthographicCamera?: boolean }).isOrthographicCamera === true
  );
}

function buildResourceUrl(
  serverUrl: string,
  streamId: string,
  commitId?: string | null,
): string {
  const base = serverUrl.replace(/\/$/, "");
  if (commitId) {
    return `${base}/streams/${streamId}/commits/${commitId}`;
  }
  return `${base}/streams/${streamId}`;
}

function nodeApplicationId(node: TreeNode): string | null {
  const raw = node.model.raw as Record<string, unknown> | undefined;
  if (!raw) {
    return null;
  }
  const direct = raw.applicationId;
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }
  const props = raw.properties;
  if (props && typeof props === "object") {
    const unique =
      (props as Record<string, unknown>).UniqueId ??
      (props as Record<string, unknown>).uniqueId;
    if (typeof unique === "string" && unique.trim()) {
      return unique.trim();
    }
  }
  return null;
}

function nodeHasDrawableGeometry(node: TreeNode): boolean {
  return Boolean(node.model.renderView?.hasGeometry);
}

/** Collect mesh node ids under ``root`` (tree children + nestedNodes). */
function collectDrawableNodeIds(root: TreeNode): string[] {
  const ids = new Set<string>();

  const visit = (node: TreeNode): void => {
    if (nodeHasDrawableGeometry(node)) {
      ids.add(node.model.id);
    }
    const nested = node.model.nestedNodes;
    if (Array.isArray(nested)) {
      for (const child of nested) {
        visit(child);
      }
    }
  };

  for (const node of root.all(() => true)) {
    visit(node);
  }
  return [...ids];
}

/**
 * Resolve drawable world-tree ids for an ``applicationId``.
 *
 * Speckle marks Revit elements as ``atomic``. ``getRenderViewsForNode`` then
 * short-circuits to the parent even when the visible mesh lives on children —
 * so programmatic select/highlight must walk descendants with ``hasGeometry``
 * (the same nodes ObjectClicked hits).
 */
function findNodeIdsByApplicationIds(applicationIds: string[]): string[] {
  if (!viewerInstance || applicationIds.length === 0) {
    return [];
  }
  const wanted = new Set(applicationIds);
  const tree = viewerInstance.getWorldTree();

  // Prefer mesh nodes that themselves carry the applicationId (click path).
  const directGeom = tree.findAll((node) => {
    if (!nodeHasDrawableGeometry(node)) {
      return false;
    }
    const appId = nodeApplicationId(node);
    return appId !== null && wanted.has(appId);
  });
  if (directGeom.length > 0) {
    return [...new Set(directGeom.map((node) => node.model.id))];
  }

  // Logical parents: collect descendant meshes (ignore atomic short-circuit).
  const parents = tree.findAll((node) => {
    const appId = nodeApplicationId(node);
    return appId !== null && wanted.has(appId);
  });

  const ids = new Set<string>();
  for (const parent of parents) {
    const drawable = collectDrawableNodeIds(parent);
    if (drawable.length > 0) {
      for (const id of drawable) {
        ids.add(id);
      }
    } else {
      ids.add(parent.model.id);
    }
  }
  return [...ids];
}

export async function initViewer(options: ViewerInitOptions): Promise<Viewer> {
  const { container, serverUrl, streamId, commitId, authToken = "" } = options;

  if (!streamId) {
    throw new Error("Speckle stream_id is empty — configure SPECKLE_STREAM_ID");
  }

  if (viewerInstance) {
    disposeViewer();
  }

  freeOrbitActive = true;

  const params = { ...DefaultViewerParams, showStats: false, verbose: false };
  const viewer = new Viewer(container, params);
  await viewer.init();

  cameraController = viewer.createExtension(CameraController);
  selectionExtension = viewer.createExtension(SelectionExtension);
  filteringExtension = viewer.createExtension(FilteringExtension);
  sectionTool = viewer.createExtension(SectionTool);
  viewer.createExtension(SectionOutlines);
  measurementsExtension = viewer.createExtension(MeasurementsExtension);
  measurementsExtension.enabled = false;
  sectionTool.enabled = false;

  const resourceUrl = buildResourceUrl(serverUrl, streamId, commitId);
  const urls = await UrlHelper.getResourceUrls(resourceUrl, authToken || undefined);
  if (urls.length === 0) {
    disposeViewer();
    throw new Error(`No Speckle resources for ${resourceUrl}`);
  }

  for (const url of urls) {
    const loader = new SpeckleLoader(viewer.getWorldTree(), url, authToken);
    await viewer.loadObject(loader, true);
  }

  viewerInstance = viewer;
  return viewer;
}

export function getViewer(): Viewer | null {
  return viewerInstance;
}

export function resizeViewer(): void {
  viewerInstance?.resize();
}

/** Fit camera to the whole loaded model. */
export function zoomExtents(): void {
  cameraController?.setCameraView(undefined, true);
}

export function setCanonicalView(view: CanonicalCameraView): void {
  cameraController?.setCameraView(view, true);
}

export function getCameraUiState(): CameraUiState {
  const orthographic = cameraController
    ? isOrthographicCamera(cameraController.renderingCamera)
    : false;
  // Speckle defaults to SmoothOrbitControls ("free orbit"); we track fly via toggle.
  return {
    orthographic,
    freeOrbit: freeOrbitActive,
  };
}

export function setOrthographic(on: boolean): void {
  if (!cameraController) {
    return;
  }
  const isOrtho = isOrthographicCamera(cameraController.renderingCamera);
  if (on && !isOrtho) {
    cameraController.setOrthoCameraOn();
  } else if (!on && isOrtho) {
    cameraController.setPerspectiveCameraOn();
  }
}

export function toggleOrthographic(): void {
  cameraController?.toggleCameras();
}

export function setFreeOrbit(on: boolean): void {
  if (!cameraController) {
    return;
  }
  if (on === freeOrbitActive) {
    return;
  }
  cameraController.toggleControls();
  freeOrbitActive = on;
}

export function toggleFreeOrbit(): void {
  if (!cameraController) {
    return;
  }
  cameraController.toggleControls();
  freeOrbitActive = !freeOrbitActive;
}

export function getToolMode(): ViewerToolMode {
  if (measurementsExtension?.enabled) {
    return "measure";
  }
  if (sectionTool?.enabled) {
    return "section";
  }
  return "none";
}

/**
 * Activate measure / section / none. Measure and section are mutually exclusive;
 * measure temporarily disables object selection.
 */
export function setToolMode(mode: ViewerToolMode): void {
  if (!viewerInstance || !measurementsExtension || !sectionTool || !selectionExtension) {
    return;
  }

  if (mode === "measure") {
    sectionTool.enabled = false;
    measurementsExtension.enabled = true;
    selectionExtension.enabled = false;
    return;
  }

  if (mode === "section") {
    measurementsExtension.enabled = false;
    measurementsExtension.clearMeasurements();
    selectionExtension.enabled = true;
    const box = viewerInstance.getRenderer().sceneBox;
    sectionTool.setBox(box);
    sectionTool.enabled = true;
    return;
  }

  measurementsExtension.enabled = false;
  measurementsExtension.clearMeasurements();
  sectionTool.enabled = false;
  selectionExtension.enabled = true;
}

/** Select objects by Revit UniqueId / Speckle ``applicationId``. */
export function selectByApplicationIds(
  applicationIds: string[],
  options: { zoom?: boolean } = {},
): void {
  if (!selectionExtension) {
    return;
  }
  if (applicationIds.length === 0) {
    selectionExtension.clearSelection();
    return;
  }
  const nodeIds = findNodeIdsByApplicationIds(applicationIds);
  selectionExtension.selectObjects(nodeIds, false);
  if (options.zoom && nodeIds.length > 0) {
    cameraController?.setCameraView(nodeIds, true);
  }
}

export function clearSelection(): void {
  selectionExtension?.clearSelection();
}

/** Raw Speckle objects currently selected (SelectionExtension). */
export function getSelectedRawObjects(): Record<string, unknown>[] {
  if (!selectionExtension) {
    return [];
  }
  return selectionExtension.getSelectedObjects();
}

/**
 * Resolve Speckle raw payloads by ``applicationId`` from the loaded world tree.
 * Prefer this over ``getSelectedRawObjects`` when syncing UI from React selection state.
 */
export function getRawObjectsByApplicationIds(
  applicationIds: string[],
): Record<string, unknown>[] {
  if (!viewerInstance || applicationIds.length === 0) {
    return [];
  }
  const wanted = new Set(applicationIds);
  const byAppId = new Map<string, Record<string, unknown>>();

  viewerInstance.getWorldTree().walk((node) => {
    const appId = nodeApplicationId(node);
    if (!appId || !wanted.has(appId) || byAppId.has(appId)) {
      return true;
    }
    const raw = node.model.raw;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      byAppId.set(appId, raw as Record<string, unknown>);
    }
    return true;
  });

  // Preserve order of requested ids.
  return applicationIds
    .map((id) => byAppId.get(id))
    .filter((obj): obj is Record<string, unknown> => obj !== undefined);
}

const HIGHLIGHT_COLOR = "#f59e0b";

export type ApplySelectionResult = {
  /** Drawable world-tree nodes resolved from the requested applicationIds. */
  matchedNodes: number;
  /** False when the viewer singleton is not ready (e.g. mid-load / HMR). */
  viewerReady: boolean;
};

function findParentNodeIdsByApplicationIds(applicationIds: string[]): string[] {
  if (!viewerInstance || applicationIds.length === 0) {
    return [];
  }
  const wanted = new Set(applicationIds);
  const parents = viewerInstance.getWorldTree().findAll((node) => {
    const appId = nodeApplicationId(node);
    return appId !== null && wanted.has(appId);
  });
  return [...new Set(parents.map((node) => node.model.id))];
}

/**
 * Tint drawable targets. Call *before* ``selectByApplicationIds`` so selection
 * materials are applied after FilteringExtension's ``resetMaterials``.
 */
export function highlightByApplicationIds(applicationIds: string[]): void {
  if (!filteringExtension) {
    return;
  }

  filteringExtension.removeUserObjectColors();

  if (applicationIds.length === 0) {
    return;
  }

  const nodeIds = findNodeIdsByApplicationIds(applicationIds);
  if (nodeIds.length === 0) {
    return;
  }

  filteringExtension.setUserObjectColors([
    { objectIds: nodeIds, color: HIGHLIGHT_COLOR },
  ]);
}

export function resetHighlight(): void {
  filteringExtension?.removeUserObjectColors();
  filteringExtension?.resetFilters();
}

/**
 * Full programmatic selection: tint + select + zoom (no isolate/ghost).
 * Isolating hundreds of nodes made the rest of the model vanish and the
 * camera frame a tiny/degenerate box, so the scene looked empty.
 */
/**
 * Programmatic selection: tint + select + optional zoom.
 * Used by SpeckleViewer for click ↔ React selection sync.
 */
export function applySelectionByApplicationIds(
  applicationIds: string[],
  options: { zoom?: boolean } = {},
): ApplySelectionResult {
  const zoom = options.zoom ?? true;

  if (!viewerInstance || !filteringExtension || !selectionExtension) {
    return { matchedNodes: 0, viewerReady: false };
  }

  if (applicationIds.length === 0) {
    filteringExtension.resetFilters();
    selectionExtension.clearSelection();
    return { matchedNodes: 0, viewerReady: true };
  }

  const drawableIds = findNodeIdsByApplicationIds(applicationIds);
  const parentIds = findParentNodeIdsByApplicationIds(applicationIds);
  const tintIds = drawableIds.length > 0 ? drawableIds : parentIds;

  if (tintIds.length === 0) {
    filteringExtension.resetFilters();
    selectionExtension.clearSelection();
    return { matchedNodes: 0, viewerReady: true };
  }

  filteringExtension.resetFilters();
  filteringExtension.setUserObjectColors([
    { objectIds: tintIds, color: HIGHLIGHT_COLOR },
  ]);
  selectionExtension.selectObjects(tintIds, false);

  if (zoom) {
    cameraController?.setCameraView(tintIds, true);
  }

  return {
    matchedNodes: tintIds.length,
    viewerReady: true,
  };
}

export function onObjectClicked(
  handler: (applicationId: string | null) => void,
): () => void {
  if (!viewerInstance) {
    return () => undefined;
  }
  const viewer = viewerInstance;
    const listener = (event: SelectionEvent | null) => {
    const hit = event?.hits[0];
    handler(hit ? nodeApplicationId(hit.node) : null);
  };
  viewer.on(ViewerEvent.ObjectClicked, listener);
  const emitter = viewer as unknown as {
    removeListener: (name: string, listener: (event: SelectionEvent | null) => void) => void;
  };
  return () => {
    emitter.removeListener(ViewerEvent.ObjectClicked, listener);
  };
}

export function disposeViewer(): void {
  viewerInstance?.dispose();
  viewerInstance = null;
  cameraController = null;
  selectionExtension = null;
  filteringExtension = null;
  measurementsExtension = null;
  sectionTool = null;
  freeOrbitActive = true;
}

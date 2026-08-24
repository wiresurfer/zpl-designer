import { createContext, useCallback, useContext, useReducer } from "react";
import type { ReactNode } from "react";

import type { Element, ElementPatch, ElementType, LabelDoc, LineBoxPreset } from "@/types/labelSchema";
import { newElement, newLabelDoc } from "@/types/labelSchema";

export interface GridConfig {
  colSpacingDots: number;
  rowSpacingDots: number;
  visible: boolean;
  snapEnabled: boolean;
}

const DEFAULT_GRID_CONFIG: GridConfig = {
  colSpacingDots: 20,
  rowSpacingDots: 20,
  visible: true,
  snapEnabled: true,
};

interface State {
  doc: LabelDoc;
  selectedIds: string[];
  gridConfig: GridConfig;
  armedTool: ElementType | null;
}

type Action =
  | { type: "SET_DOC"; doc: LabelDoc }
  | { type: "SET_NAME"; name: string }
  | { type: "ADD_ELEMENT"; element: Element }
  | { type: "ADD_ELEMENTS"; elements: Element[] }
  | { type: "UPDATE_ELEMENT"; id: string; patch: ElementPatch }
  | { type: "DELETE_ELEMENT"; id: string }
  | { type: "DELETE_ELEMENTS"; ids: string[] }
  | { type: "SELECT"; id: string | null }
  | { type: "TOGGLE_SELECT"; id: string }
  | { type: "SELECT_MANY"; ids: string[] }
  | { type: "CLEAR_SELECTION" }
  | { type: "SET_GRID_CONFIG"; patch: Partial<GridConfig> }
  | { type: "SET_ARMED_TOOL"; tool: ElementType | null };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_DOC":
      return { ...state, doc: action.doc, selectedIds: [] };
    case "SET_NAME":
      return { ...state, doc: { ...state.doc, name: action.name } };
    case "ADD_ELEMENT":
      return { ...state, doc: { ...state.doc, elements: [...state.doc.elements, action.element] } };
    case "ADD_ELEMENTS":
      return { ...state, doc: { ...state.doc, elements: [...state.doc.elements, ...action.elements] } };
    case "UPDATE_ELEMENT":
      return {
        ...state,
        doc: {
          ...state.doc,
          elements: state.doc.elements.map((el) =>
            el.id === action.id ? ({ ...el, ...action.patch } as Element) : el,
          ),
        },
      };
    case "DELETE_ELEMENT":
      return {
        ...state,
        doc: { ...state.doc, elements: state.doc.elements.filter((el) => el.id !== action.id) },
        selectedIds: state.selectedIds.filter((id) => id !== action.id),
      };
    case "DELETE_ELEMENTS":
      return {
        ...state,
        doc: { ...state.doc, elements: state.doc.elements.filter((el) => !action.ids.includes(el.id)) },
        selectedIds: state.selectedIds.filter((id) => !action.ids.includes(id)),
      };
    case "SELECT":
      return { ...state, selectedIds: action.id ? [action.id] : [] };
    case "TOGGLE_SELECT":
      return {
        ...state,
        selectedIds: state.selectedIds.includes(action.id)
          ? state.selectedIds.filter((id) => id !== action.id)
          : [...state.selectedIds, action.id],
      };
    case "SELECT_MANY":
      return { ...state, selectedIds: action.ids };
    case "CLEAR_SELECTION":
      return { ...state, selectedIds: [] };
    case "SET_GRID_CONFIG":
      return { ...state, gridConfig: { ...state.gridConfig, ...action.patch } };
    case "SET_ARMED_TOOL":
      return { ...state, armedTool: action.tool };
  }
}

interface LabelStoreValue {
  doc: LabelDoc;
  selectedIds: string[];
  selectedElements: Element[];
  /** Back-compat single-selection derived values -- non-null only when
   * exactly one element is selected. */
  selectedId: string | null;
  selectedElement: Element | null;
  gridConfig: GridConfig;
  armedTool: ElementType | null;
  setDoc: (doc: LabelDoc) => void;
  setName: (name: string) => void;
  addElement: (type: ElementType, preset?: LineBoxPreset) => void;
  addElementAt: (type: ElementType, x: number, y: number, patch?: ElementPatch) => void;
  updateElement: (id: string, patch: ElementPatch) => void;
  deleteElement: (id: string) => void;
  deleteSelection: () => void;
  duplicateElement: (id: string) => void;
  duplicateSelection: () => void;
  select: (id: string | null) => void;
  toggleSelect: (id: string) => void;
  selectMany: (ids: string[]) => void;
  clearSelection: () => void;
  setGridConfig: (patch: Partial<GridConfig>) => void;
  setArmedTool: (tool: ElementType | null) => void;
}

const LabelStoreContext = createContext<LabelStoreValue | null>(null);

export function LabelStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    doc: newLabelDoc(),
    selectedIds: [],
    gridConfig: DEFAULT_GRID_CONFIG,
    armedTool: null,
  }));

  const setDoc = useCallback((doc: LabelDoc) => dispatch({ type: "SET_DOC", doc }), []);
  const setName = useCallback((name: string) => dispatch({ type: "SET_NAME", name }), []);
  const select = useCallback((id: string | null) => dispatch({ type: "SELECT", id }), []);
  const toggleSelect = useCallback((id: string) => dispatch({ type: "TOGGLE_SELECT", id }), []);
  const selectMany = useCallback((ids: string[]) => dispatch({ type: "SELECT_MANY", ids }), []);
  const clearSelection = useCallback(() => dispatch({ type: "CLEAR_SELECTION" }), []);
  const setGridConfig = useCallback((patch: Partial<GridConfig>) => dispatch({ type: "SET_GRID_CONFIG", patch }), []);
  const setArmedTool = useCallback((tool: ElementType | null) => dispatch({ type: "SET_ARMED_TOOL", tool }), []);
  const updateElement = useCallback(
    (id: string, patch: ElementPatch) => dispatch({ type: "UPDATE_ELEMENT", id, patch }),
    [],
  );
  const deleteElement = useCallback((id: string) => dispatch({ type: "DELETE_ELEMENT", id }), []);
  const deleteSelection = useCallback(
    () => dispatch({ type: "DELETE_ELEMENTS", ids: state.selectedIds }),
    [state.selectedIds],
  );

  const duplicateElement = useCallback(
    (id: string) => {
      const original = state.doc.elements.find((el) => el.id === id);
      if (!original) return;
      const clone: Element = { ...original, id: crypto.randomUUID(), x: original.x + 15, y: original.y + 15 };
      dispatch({ type: "ADD_ELEMENT", element: clone });
      dispatch({ type: "SELECT", id: clone.id });
    },
    [state.doc.elements],
  );

  const duplicateSelection = useCallback(() => {
    const originals = state.doc.elements.filter((el) => state.selectedIds.includes(el.id));
    if (originals.length === 0) return;
    const clones = originals.map((el) => ({ ...el, id: crypto.randomUUID(), x: el.x + 15, y: el.y + 15 }));
    dispatch({ type: "ADD_ELEMENTS", elements: clones });
    dispatch({ type: "SELECT_MANY", ids: clones.map((c) => c.id) });
  }, [state.doc.elements, state.selectedIds]);

  const addElement = useCallback(
    (type: ElementType, preset?: LineBoxPreset) => {
      const offset = (state.doc.elements.length % 8) * 12;
      const element = newElement(type, 20 + offset, 20 + offset, preset);
      dispatch({ type: "ADD_ELEMENT", element });
      dispatch({ type: "SELECT", id: element.id });
    },
    [state.doc.elements.length],
  );

  const addElementAt = useCallback((type: ElementType, x: number, y: number, patch?: ElementPatch) => {
    const element = { ...newElement(type, x, y), ...(patch as object) } as Element;
    dispatch({ type: "ADD_ELEMENT", element });
    dispatch({ type: "SELECT", id: element.id });
  }, []);

  const selectedElements = state.doc.elements.filter((el) => state.selectedIds.includes(el.id));
  const selectedId = state.selectedIds.length === 1 ? state.selectedIds[0] : null;
  const selectedElement = selectedElements.length === 1 ? selectedElements[0] : null;

  const value: LabelStoreValue = {
    doc: state.doc,
    selectedIds: state.selectedIds,
    selectedElements,
    selectedId,
    selectedElement,
    gridConfig: state.gridConfig,
    armedTool: state.armedTool,
    setDoc,
    setName,
    addElement,
    addElementAt,
    updateElement,
    deleteElement,
    deleteSelection,
    duplicateElement,
    duplicateSelection,
    select,
    toggleSelect,
    selectMany,
    clearSelection,
    setGridConfig,
    setArmedTool,
  };

  return <LabelStoreContext.Provider value={value}>{children}</LabelStoreContext.Provider>;
}

export function useLabelStore(): LabelStoreValue {
  const ctx = useContext(LabelStoreContext);
  if (!ctx) throw new Error("useLabelStore must be used within LabelStoreProvider");
  return ctx;
}

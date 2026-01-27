import React, { useState } from "react";
import {
    DragDropContext,
    Droppable,
    Draggable,
    DropResult,
    DroppableProvided,
} from "@hello-pangea/dnd";
import {
    GripVertical,
    Type,
    Calendar,
    User,
    LayoutTemplate,
    Plus,
    Trash2,
    Columns,
    Minus,
    ArrowDownToLine,
    SeparatorHorizontal,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

// --- Types ---

export type SectionType = "module" | "structure" | "container";
export type StructureSubtype = "pageBreak" | "divider" | "spacer" | "2-column";

export interface PdfSection {
    id: string;
    label: string;
    enabled: boolean; // Kept for backward compatibility/modules
    type: SectionType;
    subtype?: StructureSubtype;
    columns?: PdfSection[][]; // For containers: [leftItems, rightItems]
}

export interface ReportHeaderConfig {
    title: string;
    showDate: boolean;
    showUser: boolean;
}

interface PdfLayoutBuilderProps {
    sections: PdfSection[];
    onReorder: (sections: PdfSection[]) => void;
    headerConfig: ReportHeaderConfig;
    onHeaderConfigChange: (config: ReportHeaderConfig) => void;
}

// --- Constants ---

const TOOLBOX_ITEMS: PdfSection[] = [
    { id: "tb-pageBreak", label: "Page Break", type: "structure", subtype: "pageBreak", enabled: true },
    { id: "tb-divider", label: "Divider Line", type: "structure", subtype: "divider", enabled: true },
    { id: "tb-spacer", label: "Vertical Spacer", type: "structure", subtype: "spacer", enabled: true },
    { id: "tb-2col", label: "2-Column Row", type: "container", subtype: "2-column", enabled: true, columns: [[], []] },
];

// --- Helper Components ---

const SectionIcon = ({ section }: { section: PdfSection }) => {
    if (section.type === "module") return <LayoutTemplate className="h-4 w-4 text-blue-500" />;
    if (section.subtype === "pageBreak") return <ArrowDownToLine className="h-4 w-4 text-orange-500" />;
    if (section.subtype === "divider") return <SeparatorHorizontal className="h-4 w-4 text-gray-500" />;
    if (section.subtype === "spacer") return <Minus className="h-4 w-4 text-gray-400" />;
    if (section.subtype === "2-column") return <Columns className="h-4 w-4 text-purple-500" />;
    return <LayoutTemplate className="h-4 w-4" />;
};

// --- recursive search to find and update a list within nested structures ---
const updateNestedList = (
    currentList: PdfSection[],
    droppableId: string,
    updateFn: (list: PdfSection[]) => PdfSection[]
): PdfSection[] => {
    // If this is the target list (root level check handled in main function usually, but good for safety)
    if (droppableId === "blueprint") return updateFn(currentList);

    return currentList.map((item) => {
        if (item.type === "container" && item.subtype === "2-column" && item.columns) {
            // Check if target is one of the columns
            // droppableId format: "col-[itemId]-[colIndex]"
            if (droppableId === `col-${item.id}-0`) {
                const newLeft = updateFn(item.columns[0]);
                return { ...item, columns: [newLeft, item.columns[1]] };
            }
            if (droppableId === `col-${item.id}-1`) {
                const newRight = updateFn(item.columns[1]);
                return { ...item, columns: [item.columns[0], newRight] };
            }

            // Recursive check if we support nested columns deeper (not enabled yet but good structure)
            return item;
        }
        return item;
    });
};

const findListById = (rootList: PdfSection[], droppableId: string): PdfSection[] | undefined => {
    if (droppableId === "blueprint") return rootList;

    for (const item of rootList) {
        if (item.type === "container" && item.columns) {
            if (droppableId === `col-${item.id}-0`) return item.columns[0];
            if (droppableId === `col-${item.id}-1`) return item.columns[1];
        }
    }
    return undefined;
};


export default function PdfLayoutBuilder({
    sections,
    onReorder,
    headerConfig,
    onHeaderConfigChange,
}: PdfLayoutBuilderProps) {
    // We separate "Available Modules" from the "Active Design"
    // In this new model, "sections" passed in includes EVERYTHING in the active design.
    // "Available Modules" are just standard modules that are NOT in the active design.

    // However, the parent currently passes a flat list where enabled=false means available.
    // WE NEED TO ADAPT:
    // 1. "blueprint" = sections.filter(s => s.enabled) (plus any structural items which are always enabled)
    // 2. "available" = sections.filter(s => !s.enabled && s.type === 'module')

    // ISSUE: The parent state doesn't know about structural items yet if they are new.
    // But if we persist them, they will be in "sections".

    const activeStructure = sections.filter(s => s.enabled);
    const availableModules = sections.filter(s => !s.enabled && (s.type === undefined || s.type === "module"));

    const handleDragEnd = (result: DropResult) => {
        const { source, destination } = result;
        if (!destination) return;

        // 1. Reordering within the SAME list
        if (source.droppableId === destination.droppableId) {
            const list = findListById(activeStructure, source.droppableId);
            if (!list) return; // Should not happen

            const newList = Array.from(list);
            const [moved] = newList.splice(source.index, 1);
            newList.splice(destination.index, 0, moved);

            if (source.droppableId === "blueprint") {
                // Root level reorder
                syncToParent(newList, availableModules);
            } else {
                // Nested reorder
                const newRoot = updateNestedList(activeStructure, source.droppableId, () => newList);
                syncToParent(newRoot, availableModules);
            }
            return;
        }

        // 2. Moving from TOOLBOX to Blueprint/Column
        if (source.droppableId === "toolbox") {
            const template = TOOLBOX_ITEMS[source.index];
            const newItem: PdfSection = {
                ...template,
                id: `struct-${template.subtype}-${Date.now()}`, // Generate unique ID
                type: template.type,
                subtype: template.subtype,
                enabled: true,
                columns: template.columns ? [[], []] : undefined
            };

            if (destination.droppableId === "blueprint") {
                const newActive = Array.from(activeStructure);
                newActive.splice(destination.index, 0, newItem);
                syncToParent(newActive, availableModules);
            } else {
                // Adding to a column
                const newRoot = updateNestedList(activeStructure, destination.droppableId, (list) => {
                    const newList = Array.from(list);
                    newList.splice(destination.index, 0, newItem);
                    return newList;
                });
                syncToParent(newRoot, availableModules);
            }
            return;
        }

        // 3. Moving from AVAILABLE to Blueprint/Column
        if (source.droppableId === "available") {
            const item = availableModules[source.index];
            const newItem = { ...item, enabled: true };
            const newAvailable = availableModules.filter(s => s.id !== item.id);

            if (destination.droppableId === "blueprint") {
                const newActive = Array.from(activeStructure);
                newActive.splice(destination.index, 0, newItem);
                syncToParent(newActive, newAvailable);
            } else {
                const newRoot = updateNestedList(activeStructure, destination.droppableId, (list) => {
                    const newList = Array.from(list);
                    newList.splice(destination.index, 0, newItem);
                    return newList;
                });
                syncToParent(newRoot, newAvailable);
            }
            return;
        }

        // 4. Moving BETWEEN Design lists (Blueprint <-> Column or Column <-> Column)
        if (source.droppableId !== destination.droppableId) {
            // Find source item
            let movedItem: PdfSection | undefined;

            // Remove from source
            let tempStructure = activeStructure;
            if (source.droppableId === "blueprint") {
                const list = Array.from(tempStructure);
                [movedItem] = list.splice(source.index, 1);
                tempStructure = list;
            } else {
                tempStructure = updateNestedList(tempStructure, source.droppableId, (list) => {
                    const newList = Array.from(list);
                    [movedItem] = newList.splice(source.index, 1);
                    return newList;
                });
            }

            if (!movedItem) return;

            // Add to destination
            if (destination.droppableId === "blueprint") {
                const list = Array.from(tempStructure);
                list.splice(destination.index, 0, movedItem);
                tempStructure = list;
            } else if (destination.droppableId === "available") {
                // Handled in specific "remove" logic usually, but drag-to-available implies disabling
                if (movedItem.type === "module") {
                    syncToParent(tempStructure, [...availableModules, { ...movedItem, enabled: false }]);
                    return;
                } else {
                    // Structure item: just delete it
                    syncToParent(tempStructure, availableModules);
                    return;
                }
            } else {
                tempStructure = updateNestedList(tempStructure, destination.droppableId, (list) => {
                    const newList = Array.from(list);
                    newList.splice(destination.index, 0, movedItem!);
                    return newList;
                });
            }

            syncToParent(tempStructure, availableModules);
        }
    };

    const syncToParent = (active: PdfSection[], available: PdfSection[]) => {
        // Flatten for parent state which might expect a single list
        // BUT wait - if we flatten, we lose the tree structure.
        // We MUST assume the Parent (Settings.tsx) can handle the tree structure in `active`.
        // The parent state 'sections' is a flat list of ALL sections (active + available).
        // For structural items, they exist only in active.
        // For modules, they exist in either.

        onReorder([...active, ...available]);
    };

    const removeItem = (item: PdfSection) => {
        // Recursively remove item from active structure
        const removeFromList = (list: PdfSection[]): PdfSection[] => {
            return list.filter(i => i.id !== item.id).map(i => {
                if (i.columns) {
                    return { ...i, columns: i.columns.map(col => removeFromList(col)) };
                }
                return i;
            });
        };

        const newActive = removeFromList(activeStructure);

        if (item.type === "module" || !item.type) {
            // Move back to available
            syncToParent(newActive, [...availableModules, { ...item, enabled: false }]);
        } else {
            // Just delete structural items
            syncToParent(newActive, availableModules);
        }
    };

    const renderDraggable = (item: PdfSection, index: number) => {
        if (item.type === "container" && item.subtype === "2-column") {
            return (
                <Draggable key={item.id} draggableId={item.id} index={index}>
                    {(provided, snapshot) => (
                        <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`group border rounded-lg bg-card shadow-sm mb-3 ${snapshot.isDragging ? "ring-2 ring-primary" : ""}`}
                        >
                            {/* Container Header */}
                            <div className="flex items-center justify-between p-2 border-b bg-muted/30 rounded-t-lg">
                                <div className="flex items-center gap-2">
                                    <div {...provided.dragHandleProps} className="cursor-grab hover:bg-muted p-1 rounded">
                                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <Badge variant="outline" className="bg-background text-xs font-normal">
                                        <Columns className="h-3 w-3 mr-1" /> 2-Column Row
                                    </Badge>
                                </div>
                                <button onClick={() => removeItem(item)} className="text-muted-foreground hover:text-destructive p-1">
                                    <XIcon className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Columns */}
                            <div className="flex divide-x h-full min-h-[100px]">
                                {[0, 1].map((colIndex) => (
                                    <Droppable key={colIndex} droppableId={`col-${item.id}-${colIndex}`} type="CANVAS">
                                        {(provided, snapshot) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.droppableProps}
                                                className={`flex-1 p-2 space-y-2 transition-colors ${snapshot.isDraggingOver ? "bg-primary/5" : "bg-background"}`}
                                            >
                                                {item.columns![colIndex].map((subItem, subIndex) => renderDraggable(subItem, subIndex))}
                                                {provided.placeholder}
                                                {item.columns![colIndex].length === 0 && (
                                                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground border border-dashed rounded py-4">
                                                        Drop here
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </Droppable>
                                ))}
                            </div>
                        </div>
                    )}
                </Draggable>
            );
        }

        // Standard Item (Module or Structural Leaf)
        return (
            <Draggable key={item.id} draggableId={item.id} index={index}>
                {(provided, snapshot) => (
                    <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`group flex items-center justify-between p-3 rounded-lg border bg-card shadow-sm mb-2 hover:shadow-md transition-all ${snapshot.isDragging ? "ring-2 ring-primary rotate-1 z-50 selection:bg-transparent" : ""}`}
                    >
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded shrink-0">
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <SectionIcon section={item} />
                            <div className="truncate">
                                <span className="text-sm font-medium">{item.label}</span>
                                {item.type === "module" && <span className="ml-2 text-[10px] text-muted-foreground uppercase bg-muted px-1 rounded">Data</span>}
                            </div>
                        </div>
                        <button
                            onClick={() => removeItem(item)}
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 transition-opacity"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                )}
            </Draggable>
        );
    };

    return (
        <div className="space-y-8">
            {/* Header Config */}
            <Card>
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg font-medium">Report Header</CardTitle>
                    <CardDescription>Customize the cover page details</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-3">
                        <Label htmlFor="reportTitle">Report Title</Label>
                        <div className="relative">
                            <Type className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="reportTitle"
                                value={headerConfig.title}
                                onChange={(e) => onHeaderConfigChange({ ...headerConfig, title: e.target.value })}
                                className="pl-9"
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between border p-2 rounded-md">
                            <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <Label htmlFor="showDate">Show Date</Label>
                            </div>
                            <Switch
                                id="showDate"
                                checked={headerConfig.showDate}
                                onCheckedChange={(c) => onHeaderConfigChange({ ...headerConfig, showDate: c })}
                            />
                        </div>
                        <div className="flex items-center justify-between border p-2 rounded-md">
                            <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <Label htmlFor="showUser">Show Prepared By</Label>
                            </div>
                            <Switch
                                id="showUser"
                                checked={headerConfig.showUser}
                                onCheckedChange={(c) => onHeaderConfigChange({ ...headerConfig, showUser: c })}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <DragDropContext onDragEnd={handleDragEnd}>
                <div className="grid lg:grid-cols-[280px_1fr] gap-6 items-start">

                    {/* Sidebar: Toolbox & Available Modules */}
                    <div className="space-y-6">
                        {/* Toolbox */}
                        <Card>
                            <CardHeader className="py-3 px-4 bg-muted/20">
                                <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                                    <LayoutTemplate className="h-4 w-4" /> Layout Elements
                                </CardTitle>
                            </CardHeader>
                            <Droppable droppableId="toolbox" isDropDisabled={true} type="CANVAS">
                                {(provided) => (
                                    <div ref={provided.innerRef} {...provided.droppableProps} className="p-3 space-y-2">
                                        {TOOLBOX_ITEMS.map((item, index) => (
                                            <Draggable key={item.id} draggableId={item.id} index={index}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                        className={`flex items-center gap-3 p-3 rounded-md border bg-card hover:border-primary/50 cursor-grab ${snapshot.isDragging ? "ring-2 ring-primary opacity-80" : ""}`}
                                                    >
                                                        <SectionIcon section={item} />
                                                        <span className="text-sm font-medium">{item.label}</span>
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </Card>

                        {/* Available Modules */}
                        <Card>
                            <CardHeader className="py-3 px-4 bg-muted/20">
                                <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                                    <Plus className="h-4 w-4" /> Data Modules
                                </CardTitle>
                            </CardHeader>
                            <Droppable droppableId="available" isDropDisabled={true} type="CANVAS">
                                {(provided) => (
                                    <div ref={provided.innerRef} {...provided.droppableProps} className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
                                        {availableModules.length === 0 && <p className="text-xs text-center text-muted-foreground py-4">All modules used</p>}
                                        {availableModules.map((item, index) => (
                                            <Draggable key={item.id} draggableId={item.id} index={index}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                        className={`flex items-center justify-between p-3 rounded-md border border-dashed bg-muted/10 hover:bg-muted/30 cursor-grab ${snapshot.isDragging ? "opacity-50" : ""}`}
                                                    >
                                                        <span className="text-sm font-medium">{item.label}</span>
                                                        <Plus className="h-3 w-3 text-muted-foreground" />
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </Card>
                    </div>

                    {/* Blueprint Canvas */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-muted-foreground">Report Blueprint</h3>
                            <Badge variant="outline" className="font-normal text-xs">
                                {activeStructure.length} Items
                            </Badge>
                        </div>

                        <div className="bg-muted/20 border-2 border-dashed border-muted-foreground/20 rounded-xl p-6 min-h-[600px]">
                            <div className="flex justify-center mb-6">
                                <Badge variant="secondary" className="px-6 py-1 text-xs uppercase tracking-widest text-muted-foreground/70">Start of Report (Cover Page)</Badge>
                            </div>

                            <Droppable droppableId="blueprint" type="CANVAS">
                                {(provided, snapshot) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className={`min-h-[400px] space-y-2 transition-colors rounded-lg p-2 ${snapshot.isDraggingOver ? "bg-primary/5 ring-1 ring-primary/20" : ""}`}
                                    >
                                        {activeStructure.length === 0 && (
                                            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground opacity-50">
                                                <LayoutTemplate className="h-12 w-12 mb-3" />
                                                <p>Drag elements here to build your report</p>
                                            </div>
                                        )}
                                        {activeStructure.map((item, index) => renderDraggable(item, index))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>

                            <div className="flex justify-center mt-6">
                                <Badge variant="secondary" className="px-6 py-1 text-xs uppercase tracking-widest text-muted-foreground/70">End of Report</Badge>
                            </div>
                        </div>
                    </div>

                </div>
            </DragDropContext>
        </div>
    );
}

function XIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
        </svg>
    )
}

import * as React from 'react'
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { ChevronRight, ChevronDown, FileText } from 'lucide-react'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

type AccordionTriggerProps = React.ComponentProps<typeof AccordionPrimitive.Trigger>

interface ComponentWithDisplayName<P = {}> extends React.ForwardRefExoticComponent<P> {
  displayName?: string;
}

const treeVariants = cva(
    'group hover:before:opacity-100 before:absolute before:rounded-lg before:left-0 px-2 before:w-full before:opacity-0 before:bg-accent/70 before:h-[2rem] before:-z-10'
)

const selectedTreeVariants = cva(
    'before:opacity-100 before:bg-accent/70 text-accent-foreground'
)

const dragOverVariants = cva(
    'before:opacity-100 before:bg-primary/20 text-primary-foreground'
)

interface TreeDataItem {
    id: string;
    name: string;
    icon?: React.ComponentType<{ className?: string }>;
    selectedIcon?: React.ComponentType<{ className?: string }>;
    openIcon?: React.ComponentType<{ className?: string }>;
    children?: TreeDataItem[];
    actions?: React.ReactNode;
    onClick?: () => void;
    draggable?: boolean;
    droppable?: boolean;
    disabled?: boolean;
    order?: number;
    parent_chapter_id?: string | null;
}

type DropAction = 'into' | 'before' | 'after';

type TreeProps = React.HTMLAttributes<HTMLDivElement> & {
    data: TreeDataItem[] | TreeDataItem
    initialSelectedItemId?: string
    onSelectChange?: (item: TreeDataItem | undefined) => void
    expandAll?: boolean
    defaultNodeIcon?: React.ComponentType<{ className?: string }>
    defaultLeafIcon?: React.ComponentType<{ className?: string }>
    onDocumentDrag?: (
        sourceItem: TreeDataItem, 
        targetItem: TreeDataItem, 
        payload?: { action: DropAction }
    ) => void
}

const TreeView = React.forwardRef<HTMLDivElement, TreeProps>(({
        data,
        initialSelectedItemId,
        onSelectChange,
        expandAll,
        defaultLeafIcon,
        defaultNodeIcon,
        className,
        onDocumentDrag,
        ...props
    },
    ref
) => {
        const [selectedItemId, setSelectedItemId] = React.useState<
            string | undefined
        >(initialSelectedItemId)
        
        const [draggedItem, setDraggedItem] = React.useState<TreeDataItem | null>(null)

        const handleSelectChange = React.useCallback(
            (item: TreeDataItem | undefined) => {
                setSelectedItemId(item?.id)
                if (onSelectChange) {
                    onSelectChange(item)
                }
            },
            [onSelectChange]
        )

        const handleDragStart = React.useCallback((item: TreeDataItem) => {
            setDraggedItem(item)
        }, [])

        const handleDrop = React.useCallback((targetItem: TreeDataItem, action: DropAction = 'into') => {
            if (draggedItem && onDocumentDrag && draggedItem.id !== targetItem.id) {
                onDocumentDrag(draggedItem, targetItem, { action });
            }
            setDraggedItem(null);
        }, [draggedItem, onDocumentDrag])

        const expandedItemIds = React.useMemo(() => {
            if (!initialSelectedItemId) {
                return [] as string[]
            }

            const ids: string[] = []

            function walkTreeItems(
                items: TreeDataItem[] | TreeDataItem,
                targetId: string
            ) {
                if (Array.isArray(items)) {
                    for (let i = 0; i < items.length; i++) {
                        ids.push(items[i]!.id)
                        if (walkTreeItems(items[i]!, targetId) && !expandAll) {
                            return true
                        }
                        if (!expandAll) ids.pop()
                    }
                } else if (!expandAll && items.id === targetId) {
                    return true
                } else if (items.children) {
                    return walkTreeItems(items.children, targetId)
                }
                return false
            }

            walkTreeItems(data, initialSelectedItemId)
            return ids
        }, [data, expandAll, initialSelectedItemId])

        return (
            <div className={cn('overflow-hidden relative p-2', className)}>
                <TreeItem
                    data={data}
                    ref={ref}
                    selectedItemId={selectedItemId}
                    handleSelectChange={handleSelectChange}
                    expandedItemIds={expandedItemIds}
                    defaultLeafIcon={defaultLeafIcon}
                    defaultNodeIcon={defaultNodeIcon}
                    handleDragStart={handleDragStart}
                    handleDrop={handleDrop}
                    draggedItem={draggedItem}
                    {...props}
                />
                <div
                    className='w-full h-[48px]'
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                        e.preventDefault();
                        handleDrop({id: 'ROOT', name: 'root'} as TreeDataItem, 'into');
                    }}
                />
            </div>
        )
    }
) as ComponentWithDisplayName<TreeProps & React.RefAttributes<HTMLDivElement>>;

(TreeView as ComponentWithDisplayName).displayName = 'TreeView';

type TreeItemProps = TreeProps & {
    selectedItemId?: string
    handleSelectChange: (item: TreeDataItem | undefined) => void
    expandedItemIds: string[]
    defaultNodeIcon?: React.ComponentType<{ className?: string }>
    defaultLeafIcon?: React.ComponentType<{ className?: string }>
    handleDragStart?: (item: TreeDataItem) => void
    handleDrop?: (item: TreeDataItem, action?: DropAction) => void // Changed to optional action
    draggedItem: TreeDataItem | null
}

const TreeItem = React.forwardRef<HTMLDivElement, TreeItemProps>(({
        className,
        data,
        selectedItemId,
        handleSelectChange,
        expandedItemIds,
        defaultNodeIcon,
        defaultLeafIcon,
        handleDragStart,
        handleDrop,
        draggedItem,
        ...props
    },
    ref
) => {
        if (!Array.isArray(data)) {
            data = [data]
        }
        return (
            <div ref={ref} role="tree" className={className} {...props}>
                <ul>
                    {data.map((item) => (
                        <li key={item.id}>
                            {item.children ? (
                                <TreeNode
                                    item={item}
                                    selectedItemId={selectedItemId}
                                    expandedItemIds={expandedItemIds}
                                    handleSelectChange={handleSelectChange}
                                    defaultNodeIcon={defaultNodeIcon}
                                    defaultLeafIcon={defaultLeafIcon}
                                    handleDragStart={handleDragStart}
                                    handleDrop={handleDrop}
                                    draggedItem={draggedItem}
                                />
                            ) : (
                                <TreeLeaf
                                    item={item}
                                    selectedItemId={selectedItemId}
                                    handleSelectChange={handleSelectChange}
                                    defaultLeafIcon={defaultLeafIcon}
                                    handleDragStart={handleDragStart}
                                    handleDrop={handleDrop}
                                    draggedItem={draggedItem}
                                />
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        )
    }
) as ComponentWithDisplayName<TreeItemProps & React.RefAttributes<HTMLDivElement>>;

(TreeItem as ComponentWithDisplayName).displayName = 'TreeItem'

interface TreeNodeProps {
    item: TreeDataItem
    handleSelectChange: (item: TreeDataItem | undefined) => void
    expandedItemIds: string[]
    selectedItemId?: string
    defaultNodeIcon?: React.ComponentType<{ className?: string }>
    defaultLeafIcon?: React.ComponentType<{ className?: string }>
    handleDragStart?: (item: TreeDataItem) => void
    handleDrop?: (item: TreeDataItem, action?: DropAction) => void // Made action optional
    draggedItem: TreeDataItem | null
}

const TreeNode: React.FC<TreeNodeProps> = ({
    item,
    handleSelectChange,
    expandedItemIds,
    selectedItemId,
    defaultNodeIcon,
    defaultLeafIcon,
    handleDragStart,
    handleDrop,
    draggedItem,
}) => {
    const [value, setValue] = React.useState(
        expandedItemIds.includes(item.id) ? [item.id] : []
    )
    const [isDragOver, setIsDragOver] = React.useState(false)

    const onDragStart = (e: React.DragEvent) => {
        if (!item.draggable) {
            e.preventDefault()
            return
        }
        e.dataTransfer.setData('text/plain', item.id)
        handleDragStart?.(item)
    }

    const onDragOver = (e: React.DragEvent) => {
        if (item.droppable !== false && draggedItem && draggedItem.id !== item.id) {
            e.preventDefault()
            setIsDragOver(true)
        }
    }

    const onDragLeave = () => {
        setIsDragOver(false)
    }

    const onDrop = (e: React.DragEvent, action: DropAction = 'into') => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragOver(false)
        if (handleDrop) {
            handleDrop(item, action)
        }
    }

    return (
        <AccordionPrimitive.Root
            type="multiple"
            value={value}
            onValueChange={(s) => setValue(s)}
        >
            <AccordionPrimitive.Item value={item.id} className="relative">
                {/* Before drop zone */}
                <div
                    className="h-1 mx-2 my-1 rounded hover:bg-primary/20 transition-colors"
                    onDragOver={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                    }}
                    onDrop={(e) => onDrop(e, 'before')}
                />
                <AccordionPrimitive.Trigger
                    className={cn(
                        treeVariants(),
                        selectedItemId === item.id && selectedTreeVariants(),
                        isDragOver && dragOverVariants()
                    )}
                    onClick={() => {
                        handleSelectChange(item)
                        item.onClick?.()
                    }}
                    draggable={!!item.draggable}
                    onDragStart={onDragStart}
                    onDragOver={(e: React.DragEvent<HTMLButtonElement>) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                    onDrop={(e: React.DragEvent<HTMLButtonElement>) => onDrop(e, 'after')}
                />
                <AccordionContent className="ml-4 pl-1 border-l">
                    <TreeItem
                        data={item.children ? item.children : item}
                        selectedItemId={selectedItemId}
                        handleSelectChange={handleSelectChange}
                        expandedItemIds={expandedItemIds}
                        defaultLeafIcon={defaultLeafIcon}
                        defaultNodeIcon={defaultNodeIcon}
                        handleDragStart={handleDragStart}
                        handleDrop={handleDrop}
                        draggedItem={draggedItem}
                    />
                </AccordionContent>
            </AccordionPrimitive.Item>
        </AccordionPrimitive.Root>
    )
}

interface TreeIconProps {
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}

const TreeIcon: React.FC<TreeIconProps> = ({ icon: Icon, className }) => {
  const IconComponent = Icon || FileText;
  return <IconComponent className={cn('h-4 w-4', className)} />;
};

interface TreeActionsProps {
  children: React.ReactNode;
}

const TreeActions: React.FC<TreeActionsProps> = ({ children }) => (
  <div className="ml-auto flex items-center gap-1">
    {children}
  </div>
);

interface TreeLeafProps {
    item: TreeDataItem;
    selectedItemId?: string;
    handleSelectChange: (item: TreeDataItem | undefined) => void;
    defaultLeafIcon?: React.ComponentType<{ className?: string }>;
    handleDragStart?: (item: TreeDataItem) => void;
    handleDrop?: (item: TreeDataItem, action?: DropAction) => void; // Made action optional
    draggedItem: TreeDataItem | null;
    className?: string;
}

const DefaultLeafIcon = FileText;

const TreeLeaf = React.forwardRef<HTMLDivElement, TreeLeafProps>(({
    item,
    selectedItemId,
    handleSelectChange,
    defaultLeafIcon: Icon = DefaultLeafIcon,
    className,
    handleDragStart,
    handleDrop,
    draggedItem,
    ...props
}, ref) => {
    const [isDragOver, setIsDragOver] = React.useState(false);

    const onDragStart = (e: React.DragEvent) => {
        if (!item.draggable || item.disabled) {
            e.preventDefault();
            return;
        }
        e.dataTransfer.setData('text/plain', item.id);
        handleDragStart?.(item);
    };

    const onDragOver = (e: React.DragEvent) => {
        if (item.droppable !== false && !item.disabled && draggedItem && draggedItem.id !== item.id) {
            e.preventDefault();
            setIsDragOver(true);
        }
    };

    const onDragLeave = () => {
        setIsDragOver(false);
    };

    const onDrop = (e: React.DragEvent, action: DropAction = 'into') => {
        if (item.disabled) return;
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        handleDrop?.(item, action);
    };

    return (
        <div className="relative">
            {/* Before drop zone */}
            <div
                className="h-1 mx-2 my-1 rounded hover:bg-primary/20 transition-colors"
                onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }}
                onDrop={(e) => onDrop(e, 'before')}
            />
            <div
                ref={ref}
                className={cn(
                    'ml-5 flex text-left items-center py-2 cursor-pointer before:right-1',
                    treeVariants(),
                    className,
                    selectedItemId === item.id && selectedTreeVariants(),
                    isDragOver && dragOverVariants(),
                    item.disabled && 'opacity-50 cursor-not-allowed pointer-events-none'
                )}
                onClick={() => {
                    if (item.disabled) return;
                    handleSelectChange(item);
                    item.onClick?.();
                }}
                draggable={!!item.draggable && !item.disabled}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDrop(e, 'into')}
                {...props}
            >
                <TreeIcon 
                    icon={item.icon || DefaultLeafIcon} 
                    className={selectedItemId === item.id ? 'text-accent-foreground' : ''} 
                />
                <span className="flex-grow text-sm truncate">{item.name}</span>
                {item.actions && (
                    <TreeActions>
                        {item.actions}
                    </TreeActions>
                )}
            </div>
            {/* After drop zone */}
            <div
                className="h-1 mx-2 my-1 rounded hover:bg-primary/20 transition-colors"
                onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }}
                onDrop={(e) => onDrop(e, 'after')}
            />
        </div>
    );
});

(TreeLeaf as ComponentWithDisplayName).displayName = 'TreeLeaf';

// Define TreeAccordionTrigger component
const TreeAccordionTrigger = React.forwardRef<
    React.ElementRef<typeof AccordionPrimitive.Trigger>,
    React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
    <AccordionPrimitive.Header className="flex">
        <AccordionPrimitive.Trigger
            ref={ref}
            className={cn(
                'flex flex-1 w-full items-center py-2 transition-all first:[&[data-state=open]>svg]:rotate-90',
                className
            )}
            {...props}
        >
            <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200 text-accent-foreground/50 mr-1" />
            {children}
        </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
));

(TreeAccordionTrigger as ComponentWithDisplayName).displayName = 'TreeAccordionTrigger';

// Define AccordionContent component
const AccordionContent = React.forwardRef<
    React.ElementRef<typeof AccordionPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
    <AccordionPrimitive.Content
        ref={ref}
        className={cn(
            'overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down',
            className
        )}
        {...props}
    >
        <div className="pb-1 pt-0">{children}</div>
    </AccordionPrimitive.Content>
));

(AccordionContent as ComponentWithDisplayName).displayName = 'AccordionContent';

// Export all components
export {
    TreeView,
    TreeLeaf,
    TreeIcon,
    TreeActions,
    TreeAccordionTrigger,
    AccordionContent,
    type TreeDataItem
};
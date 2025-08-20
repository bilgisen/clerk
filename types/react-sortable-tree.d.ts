declare module "react-sortable-tree" {
  import * as React from "react";

  export interface TreeItem {
    title: string | React.ReactNode;
    children?: TreeItem[];
    expanded?: boolean;
    [prop: string]: any;
  }

  export interface NodeData {
    node: TreeItem;
    path: (string | number)[];
    treeIndex: number;
    nextParentNode?: TreeItem;
    prevPath?: (string | number)[];
    nextPath?: (string | number)[];
  }

  export interface OnMovePreviousAndNextLocation {
    prevTreeIndex: number;
    nextTreeIndex: number;
    prevPath: (string | number)[];
    nextPath: (string | number)[];
  }

  export interface SortableTreeProps {
    treeData: TreeItem[];
    onChange: (treeData: TreeItem[]) => void;
    generateNodeProps?: (rowInfo: NodeData) => any;
    onMoveNode?: (args: NodeData & { treeIndex: number }) => void;
    [prop: string]: any;
  }

  export default class SortableTree extends React.Component<SortableTreeProps> {}
}

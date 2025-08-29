import { type NodeKey, type SerializedLexicalNode, type Spread, $applyNodeReplacement, DecoratorNode, type DOMConversionMap, type DOMConversionOutput, type EditorConfig, type LexicalEditor, type LexicalNode, type NodeMutation } from 'lexical';
import { Suspense, lazy } from 'react';

const PollComponent = lazy(
  () => import('@/components/editor/editor-ui/poll-component')
);

export type PollOption = {
  id: string;
  text: string;
  votes: number;
};

export type SerializedPollNode = Spread<
  {
    question: string;
    options: PollOption[];
    totalVotes: number;
    type: 'poll';
    version: 1;
  },
  SerializedLexicalNode
>;

export class PollNode extends DecoratorNode<JSX.Element> {
  __question: string;
  __options: PollOption[];
  __totalVotes: number;

  static getType(): string {
    return 'poll';
  }

  static clone(node: PollNode): PollNode {
    return new PollNode(
      node.__question,
      [...node.__options],
      node.__totalVotes,
      node.__key
    );
  }

  constructor(
    question: string,
    options: PollOption[],
    totalVotes: number,
    key?: NodeKey
  ) {
    super(key);
    this.__question = question;
    this.__options = options;
    this.__totalVotes = totalVotes;
  }

  static importJSON(serializedNode: SerializedPollNode): PollNode {
    const node = $createPollNode(
      serializedNode.question,
      serializedNode.options,
      serializedNode.totalVotes
    );
    return node;
  }

  exportJSON(): SerializedPollNode {
    return {
      question: this.__question,
      options: this.__options,
      totalVotes: this.__totalVotes,
      type: 'poll',
      version: 1,
    };
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const element = document.createElement('div');
    element.className = 'poll-node';
    return element;
  }

  updateDOM(_prevNode: unknown, _dom: HTMLElement): boolean {
    return false;
  }

  decorate(_editor: LexicalEditor, config: EditorConfig): JSX.Element {
    return (
      <Suspense fallback={null}>
        <PollComponent
          question={this.__question}
          options={this.__options}
          totalVotes={this.__totalVotes}
          nodeKey={this.__key}
          editor={_editor}
        />
      </Suspense>
    );
  }

  getQuestion(): string {
    return this.__question;
  }

  setQuestion(question: string): void {
    const writable = this.getWritable();
    writable.__question = question;
  }

  getOptions(): PollOption[] {
    return this.__options;
  }

  setOptions(options: PollOption[]): void {
    const writable = this.getWritable();
    writable.__options = options;
  }

  getTotalVotes(): number {
    return this.__totalVotes;
  }

  setTotalVotes(totalVotes: number): void {
    const writable = this.getWritable();
    writable.__totalVotes = totalVotes;
  }
}

export function $createPollNode(
  question: string,
  options: PollOption[],
  totalVotes: number = 0
): PollNode {
  return $applyNodeReplacement(new PollNode(question, options, totalVotes));
}

export function $isPollNode(
  node: LexicalNode | null | undefined
): node is PollNode {
  return node instanceof PollNode;
}

export function $getOrCreatePollNode(
  question: string = '',
  options: PollOption[] = [
    { id: '1', text: '', votes: 0 },
    { id: '2', text: '', votes: 0 },
  ],
  totalVotes: number = 0
): PollNode {
  return $createPollNode(question, options, totalVotes);
}

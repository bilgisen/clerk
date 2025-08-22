'use client';

import React, { useMemo, useCallback } from 'react';
import { Tree, NodeRendererProps } from 'react-arborist';
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus, GripVertical } from 'lucide-react';

// Define the chapter structure based on your API response
interface Chapter {
  id: string;
  title: string;
  order?: number;
  parent_chapter_id?: string | null;
  children?: Chapter[];
  [key: string]: any; // Allow additional properties
}

interface ChapterTreeArboristProps {
  bookSlug: string;
  onSelectChapter?: (chapter: Chapter) => void;
  selectedChapterId?: string | null;
}

export function ChapterTreeArborist({ 
  bookSlug, 
  onSelectChapter,
  selectedChapterId 
}: ChapterTreeArboristProps) {
  const { getToken } = useAuth();
  
  const { data, isLoading, error, refetch } = useQuery<{
    flat: Chapter[];
    tree: Chapter[];
  }>({
    queryKey: ['chapters', bookSlug],
    queryFn: async () => {
      try {
        const token = await getToken();
        const response = await fetch(`/api/books/by-slug/${bookSlug}/chapters`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          cache: 'no-store'
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch chapters');
        }
        
        return response.json();
      } catch (error) {
        console.error('Error fetching chapters:', error);
        throw error;
      }
    }
  });

  // Transform the tree data for react-arborist
  const treeData = useMemo(() => {
    if (!data?.tree) return [];
    
    const transformChapters = (chapters: Chapter[]): any[] => {
      return chapters.map(chapter => {
        // Ensure children is always an array and properly transformed
        const children = Array.isArray(chapter.children) 
          ? transformChapters(chapter.children) 
          : [];
          
        // Create a new object without the original children to avoid type conflicts
        const { children: _, ...chapterWithoutChildren } = chapter;
        return {
          ...chapterWithoutChildren,
          id: chapter.id,
          name: chapter.title, // react-arborist looks for 'name' by default
          children,
          isOpen: true, // Make sure nodes are expanded by default
          isLeaf: children.length === 0
        };
      });
    };
    
    return transformChapters(data.tree);
  }, [data]);

  const handleMove = useCallback(async (args: {
    dragIds: string[];
    dragNodes: any[];
    parentId: string | null;
    index: number;
  }) => {
    try {
      const token = await getToken();
      const { dragIds, parentId, index } = args;
      const chapterId = dragIds[0];
      
      // Get the current tree data to calculate the correct order and level
      const currentTree = data?.tree || [];
      
      // Find the chapter being moved
      const findChapter = (chapters: Chapter[], id: string): any => {
        for (const chapter of chapters) {
          if (chapter.id === id) return chapter;
          if (chapter.children) {
            const found = findChapter(chapter.children, id);
            if (found) return found;
          }
        }
        return null;
      };
      
      const movedChapter = findChapter(currentTree, chapterId);
      if (!movedChapter) return;
      
      // Determine the new level based on parent
      const newLevel = parentId === 'root' || !parentId ? 0 : 
        (findChapter(currentTree, parentId)?.level || 0) + 1;
      
      // Prepare the patch data
      const patchData = {
        bookId: movedChapter.bookId,
        patches: [{
          id: chapterId,
          order: index,
          level: newLevel,
          parentChapterId: parentId === 'root' ? null : parentId
        }]
      };
      
      // Send the update to the reorder API
      const response = await fetch('/api/chapters/reorder', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(patchData)
      });
      
      if (!response.ok) {
        throw new Error('Failed to update chapter order');
      }
      
      // Refresh the chapter list
      await refetch();
    } catch (error) {
      console.error('Error moving chapter:', error);
      // Optionally show an error message to the user
    }
  }, [bookSlug, getToken, refetch, data]);

  const handleCreate = useCallback(async (parentId: string | null) => {
    try {
      const token = await getToken();
      
      // First, get the book ID
      const bookResponse = await fetch(`/api/books/by-slug/${bookSlug}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!bookResponse.ok) {
        throw new Error('Failed to fetch book details');
      }
      
      const book = await bookResponse.json();
      
      // Create the new chapter
      const response = await fetch(`/api/books/by-slug/${bookSlug}/chapters`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'New Chapter',
          parentId: parentId === 'root' ? null : parentId,
          bookId: book.id,
          content: '',
          order: 0 // This will be updated by the reorder API
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to create chapter');
      }
      
      // Refresh the chapter list
      await refetch();
    } catch (error) {
      console.error('Error creating chapter:', error);
      // Optionally show an error message to the user
    }
  }, [bookSlug, getToken, refetch]);

  const ChapterNode = ({ node, style, dragHandle }: NodeRendererProps<any>) => {
    return (
      <div 
        ref={dragHandle}
        style={style} 
        className={`flex items-center px-2 py-1 hover:bg-gray-100 rounded ${node.data.id === selectedChapterId ? 'bg-blue-50' : ''}`}
        onClick={() => {
          if (onSelectChapter) {
            onSelectChapter(node.data);
          }
        }}
      >
        <GripVertical className="w-4 h-4 mr-2 text-gray-400 cursor-move" />
        <span className="truncate">{node.data.title}</span>
        <div className="ml-auto flex space-x-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              handleCreate(node.data.id);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500 p-4">Error loading chapters. Please try again.</div>;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-2 border-b flex justify-between items-center">
        <h3 className="font-medium">Chapters</h3>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => handleCreate(null)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Chapter
        </Button>
      </div>
      
      <div className="flex-1 overflow-auto">
        <Tree
          data={treeData}
          openByDefault={true}
          width="100%"
          height={600}
          indent={24}
          rowHeight={36}
          paddingTop={8}
          paddingBottom={8}
          onMove={handleMove}
          initialOpenState={undefined}
        >
          {ChapterNode}
        </Tree>
      </div>
    </div>
  );
}

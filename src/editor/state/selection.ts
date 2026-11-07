import { reactive, ref } from 'vue';

/**
 * Выделение: набор нод и (отдельно) одна выбранная связь. Не входит в историю и в файл.
 * Selection: a set of nodes and, separately, one selected link. Not part of history or the file.
 */
export function useSelection() {
    const selection = reactive(new Set<string>());
    const selectedConnection = ref<string | null>(null);

    function setSelection(ids: Iterable<string>) {
        const next = new Set(ids);
        for (const id of [...selection]) if (!next.has(id)) selection.delete(id);
        for (const id of next) selection.add(id);
    }

    function toggleSelected(id: string) {
        if (!selection.delete(id)) selection.add(id);
    }

    function selectConnection(id: string | null) {
        selectedConnection.value = id;
    }

    /** Выбрать одну ноду и снять выбор со связи. / Select one node and drop the link selection. */
    function selectOnly(id: string) {
        setSelection([id]);
        selectedConnection.value = null;
    }

    /** Выбрать одну связь и снять выбор с нод. / Select one link and drop the node selection. */
    function selectOnlyConnection(id: string) {
        selection.clear();
        selectedConnection.value = id;
    }

    function clearSelection() {
        selection.clear();
        selectedConnection.value = null;
    }

    return { selection, selectedConnection, setSelection, toggleSelected, selectConnection, selectOnly, selectOnlyConnection, clearSelection };
}

export type SelectionSlice = ReturnType<typeof useSelection>;

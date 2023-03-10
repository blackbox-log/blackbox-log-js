import { Headers } from './headers';
import { WasmPointer } from './wasm';

import type { WasmExports, WasmObject } from './wasm';

export class File implements WasmObject {
	readonly #wasm: WasmExports;
	readonly #ptr: WasmPointer;

	#headers: Array<WeakRef<Headers>> = [];

	constructor(wasm: WasmExports, data: Uint8Array) {
		this.#wasm = wasm;

		const dataPtr = this.#wasm.data_alloc(data.length);
		if (dataPtr === 0) {
			throw new Error('file allocation failed');
		}

		const buffer = new Uint8Array(this.#wasm.memory.buffer, dataPtr, data.length);
		buffer.set(data);

		const filePtr = this.#wasm.file_new(dataPtr, data.length);
		this.#ptr = new WasmPointer(filePtr, wasm.file_free);
	}

	free() {
		for (const headers of this.#headers) {
			headers.deref()?.free();
		}

		this.#ptr.free();
	}

	get isAlive(): boolean {
		return this.#ptr.isAlive;
	}

	get logCount(): number {
		return this.#wasm.file_logCount(this.#ptr.ptr);
	}

	parseHeaders(index: number): Headers | undefined {
		if (index >= this.logCount) {
			return undefined;
		}

		if (index in this.#headers && this.#headers[index].deref()?.isAlive) {
			return this.#headers[index].deref();
		}

		const headers = new Headers(this.#wasm, this.#ptr.ptr, index);
		this.#headers[index] = new WeakRef(headers);
		return headers;
	}

	get memorySize(): number {
		return this.#wasm.memory.buffer.byteLength;
	}
}

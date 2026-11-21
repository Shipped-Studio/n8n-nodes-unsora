import type { IDataObject, IExecuteFunctions, JsonObject } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import type { OperationHandlers } from '../../shared/descriptions';
import { deleteRecord, listRecords } from '../../shared/generation';
import { compact, unsoraApiRequest } from '../../shared/transport';
import { unwrapData } from '../../shared/utils';

/** Files up to this size are sent inline as base64 (the API's JSON limit is 10 MB). */
export const INLINE_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

/** Signed-URL upload: get an upload URL, PUT the bytes to storage, then register the file. */
async function uploadViaSignedUrl(
	this: IExecuteFunctions,
	itemIndex: number,
	buffer: Buffer,
	fileName: string,
	contentType: string | undefined,
): Promise<IDataObject> {
	const signed = unwrapData(
		await unsoraApiRequest.call(this, 'POST', '/uploads/signed-url', {
			body: { fileName },
			itemIndex,
		}),
	);
	const uploadUrl = typeof signed.uploadUrl === 'string' ? signed.uploadUrl : '';
	const blobName = typeof signed.blobName === 'string' ? signed.blobName : '';
	if (!uploadUrl || !blobName) {
		throw new NodeOperationError(this.getNode(), 'Unsora did not return an upload URL', {
			itemIndex,
		});
	}

	// Storage URL, not the Unsora API: sent without the API key.
	try {
		await this.helpers.httpRequest({
			method: 'PUT',
			url: uploadUrl,
			body: buffer,
			headers: { 'Content-Type': contentType || 'application/octet-stream' },
			json: false,
		});
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject, {
			message: 'Uploading the file to Unsora storage failed',
			itemIndex,
		});
	}

	const response = await unsoraApiRequest.call(this, 'POST', '/uploads/complete', {
		body: { blobName, fileName },
		itemIndex,
	});
	return unwrapData(response);
}

export const uploadOperations: OperationHandlers = {
	async createFromUrl(itemIndex) {
		const options = this.getNodeParameter('options', itemIndex, {}) as IDataObject;
		const body = compact({
			url: (this.getNodeParameter('url', itemIndex) as string).trim(),
			fileName: options.fileName as string | undefined,
			contentType: options.contentType as string | undefined,
		});
		const response = await unsoraApiRequest.call(this, 'POST', '/uploads', { body, itemIndex });
		return unwrapData(response);
	},

	async uploadFile(itemIndex) {
		const options = this.getNodeParameter('options', itemIndex, {}) as IDataObject;
		const binaryPropertyName = this.getNodeParameter('binaryPropertyName', itemIndex) as string;
		const binaryData = this.helpers.assertBinaryData(itemIndex, binaryPropertyName);
		const buffer = await this.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);

		const fileName =
			(options.fileName as string | undefined) ||
			binaryData.fileName ||
			`upload${binaryData.fileExtension ? `.${binaryData.fileExtension}` : ''}`;
		const contentType = (options.contentType as string | undefined) || binaryData.mimeType;

		// The API reads JSON bodies up to 10 MB, so only small files go inline as base64.
		// Larger files are sent straight to Unsora storage through a signed upload URL.
		if (buffer.length <= INLINE_UPLOAD_MAX_BYTES) {
			const body = compact({ base64: buffer.toString('base64'), fileName, contentType });
			const response = await unsoraApiRequest.call(this, 'POST', '/uploads', { body, itemIndex });
			return unwrapData(response);
		}
		return await uploadViaSignedUrl.call(this, itemIndex, buffer, fileName, contentType);
	},

	async getAll(itemIndex) {
		return await listRecords.call(this, itemIndex, '/uploads');
	},

	async delete(itemIndex) {
		return await deleteRecord.call(this, itemIndex, '/uploads', 'uploadId');
	},
};

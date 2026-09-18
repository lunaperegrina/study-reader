export class AppError extends Error {
	code: string;
	statusCode: number;
	details?: Record<string, unknown>;

	constructor(
		code: string,
		statusCode: number,
		message: string,
		details?: Record<string, unknown>,
	) {
		super(message);
		this.code = code;
		this.statusCode = statusCode;
		this.details = details;
	}
}

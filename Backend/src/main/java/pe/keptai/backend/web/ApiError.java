package pe.keptai.backend.web;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.slf4j.MDC;

public record ApiError(String code, String message, @JsonProperty("request_id") String requestId) {

	public static ApiError of(String code, String message) {
		return new ApiError(code, message, MDC.get(RequestIdFilter.MDC_KEY));
	}

	/** JSON manual para handlers de seguridad, que escriben fuera de MVC. */
	public String toJson() {
		return "{\"code\":\"" + code + "\",\"message\":\"" + message + "\",\"request_id\":"
				+ (requestId == null ? "null" : "\"" + requestId + "\"") + "}";
	}

}

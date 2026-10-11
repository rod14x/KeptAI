package pe.keptai.backend.security;

import org.springframework.security.authentication.AuthenticationServiceException;

/** La base no pudo resolver la membresía: se falla cerrado (503), nunca se asume una identidad. */
public class MembershipUnavailableException extends AuthenticationServiceException {

	public MembershipUnavailableException(String message, Throwable cause) {
		super(message, cause);
	}

	public MembershipUnavailableException(String message) {
		super(message);
	}

}

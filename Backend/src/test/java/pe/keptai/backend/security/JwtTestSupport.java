package pe.keptai.backend.security;

import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.security.KeyPairGenerator;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.UUID;

import com.nimbusds.jose.JOSEObjectType;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.ECDSASigner;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.Curve;
import com.nimbusds.jose.jwk.ECKey;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.PlainJWT;
import com.nimbusds.jwt.SignedJWT;
import com.sun.net.httpserver.HttpServer;

/**
 * Fixture de pruebas: claves RSA/EC generadas en memoria y un JWKS servido por HTTP local.
 * No es Supabase Auth real: acredita la validación del decodificador, no la integración con Auth.
 */
final class JwtTestSupport {

	static final String ISSUER = "http://localhost/test-issuer";

	static final String AUDIENCE = "authenticated";

	static final String KID_RSA = "test-rsa";

	static final String KID_EC = "test-ec";

	private static final RSAKey RSA;

	private static final RSAKey OTHER_RSA;

	private static final ECKey EC;

	private static final HttpServer SERVER;

	static {
		try {
			RSA = rsa(KID_RSA);
			OTHER_RSA = rsa(KID_RSA); // mismo kid, otra clave: firma incorrecta
			KeyPairGenerator g = KeyPairGenerator.getInstance("EC");
			g.initialize(256);
			var kp = g.generateKeyPair();
			EC = new ECKey.Builder(Curve.P_256, (ECPublicKey) kp.getPublic()).privateKey((ECPrivateKey) kp.getPrivate()).keyID(KID_EC).build();
			byte[] jwks = new JWKSet(List.of(RSA.toPublicJWK(), EC.toPublicJWK())).toString().getBytes(StandardCharsets.UTF_8);
			SERVER = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
			SERVER.createContext("/jwks", ex -> {
				ex.getResponseHeaders().add("Content-Type", "application/json");
				ex.sendResponseHeaders(200, jwks.length);
				ex.getResponseBody().write(jwks);
				ex.close();
			});
			SERVER.start();
		}
		catch (Exception e) {
			throw new ExceptionInInitializerError(e);
		}
	}

	private JwtTestSupport() {
	}

	private static RSAKey rsa(String kid) throws Exception {
		KeyPairGenerator g = KeyPairGenerator.getInstance("RSA");
		g.initialize(2048);
		var kp = g.generateKeyPair();
		return new RSAKey.Builder((RSAPublicKey) kp.getPublic()).privateKey((RSAPrivateKey) kp.getPrivate()).keyID(kid).build();
	}

	static String jwksUri() {
		return "http://127.0.0.1:" + SERVER.getAddress().getPort() + "/jwks";
	}

	static JWTClaimsSet.Builder claims(String sub) {
		Instant now = Instant.now();
		JWTClaimsSet.Builder b = new JWTClaimsSet.Builder().issuer(ISSUER).audience(AUDIENCE)
			.issueTime(Date.from(now)).expirationTime(Date.from(now.plusSeconds(600)));
		return sub == null ? b : b.subject(sub);
	}

	static String rs256(JWTClaimsSet claims) {
		return sign(claims, rsaSigner(RSA), new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(KID_RSA).type(JOSEObjectType.JWT).build());
	}

	static String es256(JWTClaimsSet claims) {
		try {
			return sign(claims, new ECDSASigner(EC), new JWSHeader.Builder(JWSAlgorithm.ES256).keyID(KID_EC).type(JOSEObjectType.JWT).build());
		}
		catch (Exception e) {
			throw new IllegalStateException(e);
		}
	}

	/** Firmado con otra clave RSA bajo el mismo kid. */
	static String wrongSignature(JWTClaimsSet claims) {
		return sign(claims, rsaSigner(OTHER_RSA), new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(KID_RSA).build());
	}

	/** HS256 con secreto arbitrario: el algoritmo simétrico no está permitido. */
	static String hs256(JWTClaimsSet claims) {
		try {
			return sign(claims, new MACSigner(new byte[32] /* 32 bytes nulos: solo fixture */), new JWSHeader.Builder(JWSAlgorithm.HS256).keyID(KID_RSA).build());
		}
		catch (Exception e) {
			throw new IllegalStateException(e);
		}
	}

	static String none(JWTClaimsSet claims) {
		return new PlainJWT(claims).serialize();
	}

	private static com.nimbusds.jose.JWSSigner rsaSigner(RSAKey key) {
		try {
			return new RSASSASigner(key);
		}
		catch (Exception e) {
			throw new IllegalStateException(e);
		}
	}

	private static String sign(JWTClaimsSet claims, com.nimbusds.jose.JWSSigner signer, JWSHeader header) {
		try {
			SignedJWT jwt = new SignedJWT(header, claims);
			jwt.sign(signer);
			return jwt.serialize();
		}
		catch (Exception e) {
			throw new IllegalStateException(e);
		}
	}

	static String uuid() {
		return UUID.randomUUID().toString();
	}

}

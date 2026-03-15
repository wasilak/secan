use criterion::{black_box, criterion_group, criterion_main, Criterion};
use secan::auth::{AuthUser, Session};

fn bench_session_creation(c: &mut Criterion) {
    c.bench_function("session_creation", |b| {
        b.iter(|| {
            let session = Session::new(
                "test-token-12345".to_string(),
                "user-123".to_string(),
                "testuser".to_string(),
                vec!["admin".to_string()],
                60,
            );
            black_box(session)
        });
    });
}

fn bench_session_validation(c: &mut Criterion) {
    let session = Session::new(
        "test-token-12345".to_string(),
        "user-123".to_string(),
        "testuser".to_string(),
        vec!["admin".to_string()],
        60,
    );

    c.bench_function("session_is_expired_false", |b| {
        b.iter(|| {
            let expired = session.is_expired();
            black_box(expired)
        });
    });
}

fn bench_session_renewal(c: &mut Criterion) {
    c.bench_function("session_renew", |b| {
        b.iter(|| {
            let mut session = Session::new(
                "test-token-12345".to_string(),
                "user-123".to_string(),
                "testuser".to_string(),
                vec!["admin".to_string()],
                60,
            );
            session.renew(60);
            black_box(session.expires_at.timestamp())
        });
    });
}

fn bench_auth_user_creation(c: &mut Criterion) {
    c.bench_function("auth_user_creation", |b| {
        b.iter(|| {
            let user = AuthUser::new(
                "user-123".to_string(),
                "testuser".to_string(),
                vec!["admin".to_string(), "viewer".to_string()],
            );
            black_box(user)
        });
    });
}

fn bench_session_serialization(c: &mut Criterion) {
    let session = Session::new(
        "test-token-12345".to_string(),
        "user-123".to_string(),
        "testuser".to_string(),
        vec!["admin".to_string()],
        60,
    );

    c.bench_function("session_serialization", |b| {
        b.iter(|| {
            let json = serde_json::to_string(&session).unwrap();
            black_box(json)
        });
    });
}

fn bench_session_deserialization(c: &mut Criterion) {
    let json = r#"{
        "token": "test-token-12345",
        "user_id": "user-123",
        "username": "testuser",
        "roles": ["admin"],
        "accessible_clusters": [],
        "created_at": "2024-01-01T00:00:00Z",
        "expires_at": "2024-01-01T01:00:00Z",
        "last_activity": "2024-01-01T00:00:00Z"
    }"#;

    c.bench_function("session_deserialization", |b| {
        b.iter(|| {
            let session: Session = serde_json::from_str(json).unwrap();
            black_box(session)
        });
    });
}

criterion_group!(
    benches,
    bench_session_creation,
    bench_session_validation,
    bench_session_renewal,
    bench_auth_user_creation,
    bench_session_serialization,
    bench_session_deserialization
);
criterion_main!(benches);

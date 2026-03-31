// Wrapper to include layout implementation from backend/src/routes/topology/layout.rs
include!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/backend/src/routes/topology/layout.rs"
));

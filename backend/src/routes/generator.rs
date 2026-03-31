// Wrapper module to include generator implementation kept under backend/src/routes/topology/
include!(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/backend/src/routes/topology/generator.rs"
));

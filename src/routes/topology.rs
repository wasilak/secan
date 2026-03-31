mod routes_topology {
    include!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/backend/src/routes/topology.rs"
    ));
}

pub use routes_topology::*;

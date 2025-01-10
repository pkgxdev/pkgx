use crate::{precision, pretty_size};

#[test]
fn test_pretty_size() {
    assert_eq!(pretty_size(0), ("0 B".to_string(), 1));
    assert_eq!(pretty_size(1), ("1 B".to_string(), 1));
    assert_eq!(pretty_size(1024), ("1.00 KiB".to_string(), 1024));
    assert_eq!(
        pretty_size(1024 * 1024),
        ("1.00 MiB".to_string(), 1024 * 1024)
    );
    assert_eq!(
        pretty_size(1024 * 1024 * 1024),
        ("1.00 GiB".to_string(), 1024 * 1024 * 1024)
    );
    assert_eq!(
        pretty_size(1024 * 1024 * 1024 * 1024),
        ("1.00 TiB".to_string(), 1024 * 1024 * 1024 * 1024)
    );
    assert_eq!(
        pretty_size(1024 * 1024 * 1024 * 1024 * 1024),
        ("1.00 PiB".to_string(), 1024 * 1024 * 1024 * 1024 * 1024)
    );
    assert_eq!(
        pretty_size(1024 * 1024 * 1024 * 1024 * 1024 * 1024),
        (
            "1.00 EiB".to_string(),
            1024 * 1024 * 1024 * 1024 * 1024 * 1024
        )
    );
    // these are bigger than u64
    // assert_eq!(
    //     pretty_size(1024 * 1024 * 1024 * 1024 * 1024 * 1024 * 1024),
    //     (
    //         "1 ZiB".to_string(),
    //         1024 * 1024 * 1024 * 1024 * 1024 * 1024 * 1024
    //     )
    // );
    // assert_eq!(
    //     pretty_size(1024 * 1024 * 1024 * 1024 * 1024 * 1024 * 1024 * 1024),
    //     (
    //         "1 YiB".to_string(),
    //         1024 * 1024 * 1024 * 1024 * 1024 * 1024 * 1024 * 1024
    //     )
    // );
    assert_eq!(pretty_size(5000), ("4.88 KiB".to_string(), 1024));
    assert_eq!(pretty_size(5120), ("5.00 KiB".to_string(), 1024));

    assert_eq!(
        pretty_size(1024 * 1024 + 1),
        ("1.00 MiB".to_string(), 1024 * 1024)
    );
    assert_eq!(
        pretty_size(35_245 * 1024),
        ("34.4 MiB".to_string(), 1024 * 1024)
    );
    assert_eq!(
        pretty_size(356_245 * 1024 + 1),
        ("348 MiB".to_string(), 1024 * 1024)
    );
}

#[test]
fn test_precision() {
    assert_eq!(precision(1.0), 2);
    assert_eq!(precision(1.1), 2);
    assert_eq!(precision(9.99), 2);
    assert_eq!(precision(10.0), 1);
    assert_eq!(precision(10.1), 1);
    assert_eq!(precision(99.9), 1);
    assert_eq!(precision(100.0), 0);
    assert_eq!(precision(100.1), 0);
    assert_eq!(precision(999.9), 0);
}

# LDAP Authentication Configuration Examples

This directory contains example configuration files for setting up LDAP authentication with various LDAP server types.

## Available Examples

### 1. Minimal Configuration (`ldap-minimal.yaml`)
A minimal LDAP configuration showing only the required parameters. Use this as a starting point for quick testing or simple setups.

**Use case:** Development, testing, simple LDAP setups without group-based access control

**Features:**
- Minimal required parameters only
- No group mapping
- No TLS (development only)
- Default attribute mappings

### 2. OpenLDAP Configuration (`ldap-openldap.yaml`)
Complete configuration example for OpenLDAP servers.

**Use case:** Organizations using OpenLDAP as their directory service

**Features:**
- User search with customizable filters
- Group membership queries (direct and reverse)
- Required group enforcement
- TLS/StartTLS configuration
- Comprehensive comments and troubleshooting tips

**Common OpenLDAP attributes:**
- User object class: `inetOrgPerson`, `organizationalPerson`
- Username attribute: `uid`
- Group object class: `groupOfNames`, `posixGroup`
- Group member attribute: `member`, `memberUid`

### 3. Active Directory Configuration (`ldap-active-directory.yaml`)
Complete configuration example for Microsoft Active Directory.

**Use case:** Organizations using Active Directory as their directory service

**Features:**
- AD-specific search filters (sAMAccountName)
- Nested group support with LDAP_MATCHING_RULE_IN_CHAIN
- memberOf attribute for efficient group queries
- Multiple bind DN format examples
- TLS/StartTLS configuration
- Comprehensive AD-specific notes

**Common Active Directory attributes:**
- User object class: `user`
- Username attribute: `sAMAccountName`, `userPrincipalName`
- Group object class: `group`
- Group member attribute: `member`
- User group attribute: `memberOf`

### 4. FreeIPA Configuration (`ldap-freeipa.yaml`)
Complete configuration example for FreeIPA (Red Hat Identity Management).

**Use case:** Organizations using FreeIPA for Linux/UNIX identity management

**Features:**
- FreeIPA-specific DN patterns
- Kerberos principal integration notes
- memberOf attribute for efficient group queries
- TLS/StartTLS configuration with CA certificate installation instructions
- Comprehensive FreeIPA-specific notes

**Common FreeIPA attributes:**
- User object class: `inetOrgPerson`, `posixAccount`, `krbPrincipalAux`
- Username attribute: `uid`
- Group object class: `groupOfNames`, `posixGroup`
- Group member attribute: `member`
- User group attribute: `memberOf`

## Quick Start

1. **Choose the appropriate example** for your LDAP server type
2. **Copy the relevant sections** to your `config.yaml`
3. **Customize the parameters** for your environment:
   - Update `server_url` with your LDAP server address
   - Update `bind_dn` and `bind_password` with your service account credentials
   - Update `search_base` with your user search base DN
   - Update `group_search_base` with your group search base DN (if using groups)
   - Update `required_groups` with your access control groups (if needed)
4. **Enable TLS** for production use (set `tls_mode: starttls` or use `ldaps://` URL)
5. **Test the configuration** with a test user account
6. **Monitor logs** for any authentication issues

## Configuration Parameters Reference

### Required Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `server_url` | LDAP server URL | `ldap://ldap.example.com:389` |
| `bind_dn` | Service account DN | `cn=service,dc=example,dc=com` |
| `bind_password` | Service account password | `password123` |
| `search_base` | User search base DN | `ou=users,dc=example,dc=com` |
| `search_filter` | User search filter | `(uid={username})` |

### Optional Parameters

| Parameter | Description | Default | Example |
|-----------|-------------|---------|---------|
| `user_dn_pattern` | Direct bind DN pattern | None | `uid={username},ou=users,dc=example,dc=com` |
| `group_search_base` | Group search base DN | None | `ou=groups,dc=example,dc=com` |
| `group_search_filter` | Group search filter | None | `(member={user_dn})` |
| `group_member_attribute` | Group member attribute | None | `member` |
| `user_group_attribute` | User group attribute | None | `memberOf` |
| `required_groups` | Required groups for access | `[]` | `["app-users", "app-admins"]` |
| `connection_timeout_seconds` | Connection timeout | `10` | `30` |
| `tls_mode` | TLS mode | `none` | `starttls`, `ldaps` |
| `tls_skip_verify` | Skip TLS verification | `false` | `true` (testing only) |
| `username_attribute` | Username attribute | `uid` | `sAMAccountName` |
| `email_attribute` | Email attribute | `mail` | `mail` |
| `display_name_attribute` | Display name attribute | `cn` | `displayName` |

## TLS Configuration

### TLS Modes

1. **none** (default): Unencrypted LDAP connection
   - **Use only for development/testing**
   - Port: 389
   - Example: `server_url: "ldap://ldap.example.com:389"`

2. **starttls**: Upgrade connection to TLS after connecting
   - **Recommended for production**
   - Port: 389
   - Example: `server_url: "ldap://ldap.example.com:389"` with `tls_mode: starttls`

3. **ldaps**: TLS from the start
   - **Alternative for production**
   - Port: 636
   - Example: `server_url: "ldaps://ldap.example.com:636"` with `tls_mode: ldaps`

### Certificate Verification

- **Production**: Always set `tls_skip_verify: false` (default)
- **Testing**: Can set `tls_skip_verify: true` to skip certificate verification
- **Best practice**: Install your LDAP server's CA certificate on the application server

## Group Mapping

### Direct Group Membership Query

Search for groups where the user is a member:

```yaml
group_search_base: "ou=groups,dc=example,dc=com"
group_search_filter: "(member={user_dn})"
group_member_attribute: "member"
```

### Reverse Group Membership Query

Extract groups from user's attributes:

```yaml
user_group_attribute: "memberOf"
```

### Required Groups

Restrict access to users in specific groups:

```yaml
required_groups:
  - "app-users"
  - "app-admins"
```

- Users must be a member of **at least one** required group
- Leave empty (`[]`) to allow all authenticated users
- Use group CN (common name), not full DN

## Search Strategies

### Search-then-Bind (Recommended)

Search for user, then bind with found DN:

```yaml
search_base: "ou=users,dc=example,dc=com"
search_filter: "(uid={username})"
```

**Advantages:**
- Works with any DN structure
- Can search across multiple OUs
- Flexible filter options

**Disadvantages:**
- Requires two LDAP operations (search + bind)
- Slightly slower than direct bind

### Direct Bind with DN Pattern

Construct user DN from username pattern:

```yaml
user_dn_pattern: "uid={username},ou=users,dc=example,dc=com"
```

**Advantages:**
- Faster (single bind operation)
- Simpler configuration

**Disadvantages:**
- Requires predictable DN structure
- Cannot search across multiple OUs
- Less flexible

## Security Best Practices

1. **Always use TLS in production**
   - Set `tls_mode: starttls` or use `ldaps://` URL
   - Never set `tls_skip_verify: true` in production

2. **Use a dedicated service account**
   - Create a service account with minimal permissions
   - Grant read-only access to users and groups
   - Do not use a user account or admin account

3. **Store passwords securely**
   - Use environment variables instead of config files
   - Example: `bind_password: "${LDAP_BIND_PASSWORD}"`
   - Never commit passwords to version control

4. **Enable required groups**
   - Restrict access to specific groups
   - Use the principle of least privilege
   - Regularly review group memberships

5. **Monitor authentication logs**
   - Set logging level to INFO or DEBUG
   - Monitor for failed authentication attempts
   - Alert on suspicious activity

6. **Keep service account password secure**
   - Use a strong, unique password
   - Rotate password regularly
   - Limit service account permissions

## Troubleshooting

### Connection Issues

**Problem:** Cannot connect to LDAP server

**Solutions:**
- Verify server URL is correct
- Check network connectivity: `telnet ldap.example.com 389`
- Verify firewall rules allow LDAP traffic
- Check LDAP server is running and accessible

### Authentication Failures

**Problem:** Users cannot authenticate

**Solutions:**
- Verify service account credentials are correct
- Test service account bind: `ldapsearch -x -D "bind_dn" -W -b "search_base"`
- Verify user search filter is correct
- Check user exists in LDAP: `ldapsearch -x -D "bind_dn" -W -b "search_base" "(uid=username)"`
- Verify user password is correct
- Check user account is not disabled or locked

### Group Membership Issues

**Problem:** Users cannot access application (required groups)

**Solutions:**
- Verify group search configuration is correct
- Test group search: `ldapsearch -x -D "bind_dn" -W -b "group_search_base" "(member=user_dn)"`
- Check user is a member of required groups
- Verify group names match exactly (case-sensitive)
- Check group_member_attribute is correct for your LDAP schema

### TLS Issues

**Problem:** TLS connection fails

**Solutions:**
- Verify TLS mode is correct (starttls vs ldaps)
- Check certificate is valid and not expired
- Install LDAP server's CA certificate on application server
- Temporarily set `tls_skip_verify: true` to test (development only)
- Check LDAP server TLS configuration

### Timeout Issues

**Problem:** LDAP operations timeout

**Solutions:**
- Increase `connection_timeout_seconds`
- Check network latency to LDAP server
- Verify LDAP server is not overloaded
- Optimize search filters to reduce result set size

## Testing LDAP Configuration

### Using ldapsearch Command

Test service account bind:
```bash
ldapsearch -x -H "ldap://ldap.example.com" \
  -D "cn=service-account,dc=example,dc=com" \
  -W -b "dc=example,dc=com" \
  "(objectClass=*)"
```

Test user search:
```bash
ldapsearch -x -H "ldap://ldap.example.com" \
  -D "cn=service-account,dc=example,dc=com" \
  -W -b "ou=users,dc=example,dc=com" \
  "(uid=testuser)"
```

Test group search:
```bash
ldapsearch -x -H "ldap://ldap.example.com" \
  -D "cn=service-account,dc=example,dc=com" \
  -W -b "ou=groups,dc=example,dc=com" \
  "(member=uid=testuser,ou=users,dc=example,dc=com)"
```

### Using Application Logs

Enable DEBUG logging to see LDAP queries:

```yaml
logging:
  level: DEBUG
  component_levels:
    ldap: DEBUG
```

Check logs for:
- LDAP connection attempts
- Service account bind results
- User search queries and results
- User bind attempts
- Group membership queries
- Authentication success/failure

## Environment Variables

You can use environment variables for sensitive configuration:

```yaml
ldap:
  server_url: "${LDAP_SERVER_URL}"
  bind_dn: "${LDAP_BIND_DN}"
  bind_password: "${LDAP_BIND_PASSWORD}"
```

Set environment variables:
```bash
export LDAP_SERVER_URL="ldap://ldap.example.com:389"
export LDAP_BIND_DN="cn=service-account,dc=example,dc=com"
export LDAP_BIND_PASSWORD="service-account-password"
```

## Additional Resources

### LDAP Standards
- RFC 4510: LDAP Technical Specification Road Map
- RFC 4511: LDAP Protocol
- RFC 4515: LDAP Search Filters
- RFC 4516: LDAP URLs

### LDAP Server Documentation
- OpenLDAP: https://www.openldap.org/doc/
- Active Directory: https://docs.microsoft.com/en-us/windows-server/identity/ad-ds/
- FreeIPA: https://www.freeipa.org/page/Documentation

### Security Resources
- OWASP LDAP Injection Prevention: https://cheatsheetseries.owasp.org/cheatsheets/LDAP_Injection_Prevention_Cheat_Sheet.html
- CWE-90: LDAP Injection: https://cwe.mitre.org/data/definitions/90.html

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review application logs with DEBUG level enabled
3. Test LDAP connectivity using ldapsearch command
4. Consult your LDAP server documentation
5. Open an issue on the project repository

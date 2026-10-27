# Owner decision, 2026-10-17

The owner accepted replacing message-only failures with typed kinds and retained
causes for endpoint errors and permanent staging refusals. Applications must be
able to recover or localize without parsing English messages. Keeping string
parsing would preserve constructors but makes messages an accidental machine API.

This replaces only the message-only restriction in ADR-0001 and ADR-0002.
Admission remains the success boundary, later writer failure remains an endpoint
failure, and bounded staging/waiting outside the owner remain required.
The owner accepts breaking the construction API and maintaining a classification
contract. Diagnostic text and operation result types stay unchanged.
The change is accepted direction; implementation has not started.

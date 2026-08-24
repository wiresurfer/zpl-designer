from app.compiler.schema import RawElement


def compile_raw(element: RawElement) -> str:
    """Passthrough for a user-authored, 0,0-relative ZPL snippet.

    The user is responsible for authoring this relative to the element's
    top-left corner and must not embed their own ^LH/^FW, which would
    conflict with the wrapper zpl_compiler applies around every element.
    """
    return element.zpl_snippet

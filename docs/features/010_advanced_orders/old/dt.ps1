$ myfilename="imp_plan"
$ pandoc \
-t markdown_strict \
--extract-media='./attachments/$myfilename' \
$myfilename.docx \
-o $myfilename.md
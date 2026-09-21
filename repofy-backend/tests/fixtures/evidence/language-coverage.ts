export const pythonSource = 'import math\nclass Calculator:\n    def twice(self, value):\n        return value * 2\ndef calculate(value):\n    return Calculator().twice(value)\n';
export const pythonTests = 'from app import calculate\ndef test_value():\n    assert calculate(2) == 4\n';
export const javaSource = 'package example; public class Calculator { public int twice(int value) { return value * 2; } }';
export const javaTests = 'package example; import org.junit.jupiter.api.Test; class CalculatorTest { @Test void works() { assert new Calculator().twice(2) == 4; } }';
export const pom = '<project xmlns="http://maven.apache.org/POM/4.0.0"><modelVersion>4.0.0</modelVersion><dependencies><dependency><groupId>org.junit.jupiter</groupId><artifactId>junit-jupiter</artifactId><version>5.11.0</version><scope>test</scope></dependency><dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter</artifactId><version>3.4.0</version></dependency></dependencies></project>';
export const languageMatrix = [
  { name: 'python_single', files: { 'app.py': pythonSource, 'tests/test_app.py': pythonTests, 'pyproject.toml': '[project]\nname="example"\nversion="1.0"\ndependencies=["fastapi>=0.110"]' }, analyzed: 3, unparsed: 0 },
  { name: 'python_multi', files: { 'one/pyproject.toml': '[project]\ndependencies=[]', 'one/app.py': pythonSource, 'two/pyproject.toml': '[project]\ndependencies=["pytest"]', 'two/tests/test_app.py': pythonTests }, analyzed: 4, unparsed: 0 },
  { name: 'java_single', files: { 'pom.xml': pom, 'src/main/Calculator.java': javaSource, 'src/test/CalculatorTest.java': javaTests }, analyzed: 3, unparsed: 0 },
  { name: 'java_multi', files: { 'pom.xml': '<project><modelVersion>4.0.0</modelVersion><modules><module>core</module></modules></project>', 'core/pom.xml': pom, 'core/src/module-info.java': 'module example.core { exports example; }', 'core/src/Calculator.java': javaSource }, analyzed: 4, unparsed: 0 },
  { name: 'mixed', files: { 'app.swift': 'func main() {}', 'app.py': pythonSource, 'schema.sql': 'CREATE TABLE examples (id integer PRIMARY KEY);', '.github/workflows/test.yml': 'on: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: pytest\n', 'README.md': '# Architecture\nA synthetic example.' }, analyzed: 4, unparsed: 1 },
  { name: 'malformed', files: { 'broken.py': 'def broken(:\n  pass', 'Broken.java': 'class {', 'pom.xml': '<project><modelVersion>4.0.0</project>' }, analyzed: 0, unparsed: 3 },
  { name: 'build_scripts', files: { 'build.gradle': "plugins { id 'java' }", 'setup.py': 'from setuptools import setup\nsetup(name="example")\n' }, analyzed: 1, unparsed: 1 },
  { name: 'native_mobile', files: { 'app.swift': 'import SwiftUI', 'App.kt': 'class App' }, analyzed: 0, unparsed: 2 },
  { name: 'generated', files: { 'generated.py': '# @generated\ndef sample(): pass', 'generated.java': '// DO NOT EDIT\nclass Example {}', 'src/app.py': pythonSource }, analyzed: 1, unparsed: 0 },
  { name: 'empty', files: {}, analyzed: 0, unparsed: 0 },
  { name: 'excluded_only', files: { 'node_modules/external.py': pythonSource }, analyzed: 0, unparsed: 0 },
  { name: 'no_meaningful_source', files: { 'empty.py': '', 'empty.java': '', 'empty.md': '' }, analyzed: 3, unparsed: 0 },
  { name: 'large_file', files: { 'large.py': '# ' + 'x'.repeat(262144), 'ok.py': pythonSource }, analyzed: 1, unparsed: 1 },
  { name: 'malformed_neighbor', files: { 'bad.py': 'def broken(:\n  pass', 'good.py': pythonSource }, analyzed: 1, unparsed: 1 },
] as const;
